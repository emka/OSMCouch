#!/usr/bin/env python
# -*- coding: utf-8 -*-
# vim: tabstop=4 expandtab shiftwidth=4 softtabstop=4

#
# oscparser - parse osmChange XML files, write to MonetDB
#

'''
Downloading osmChange
=======================
base URL: http://planet.openstreetmap.org/minute-replicate/

/state.txt contains relevant variables: sequenceNumber, timestamp

sequenceNumber: 9 digit sequence number used to create path /012/345/678.osc.gz
if sequence number has less than 9 digits, prefix zeros


osmChange structure
=======================
<osmChange version="0.6" generator="Osmosis $osmosis_version">
    <create/>
    <modify/>
    <delete>
        <node id version timestamp uid user changeset lat lon>
            <tag k v/>
        </node>
        <way id version timestamp uid user changeset>
            <nd ref/>
            <tag k v/>
        </way>
        <relation id version timestamp uid user changeset>
            <member type ref role/>
            <tag k v/>
        </relation>
    </delete>
</osmChange>

create, modify, delete may appear multiple times in any order. Their childs are identical.
'''

import sys
import os
import xml.sax
import xml.sax.handler
from datetime import datetime

import settings

class OSCReader(xml.sax.handler.ContentHandler):
    '''
    Read SAX events in an OSM Changeset XML file, forward results to consumer
    '''
    def __init__(self, consumer):
        self.consumer = consumer
        self.mode = "create" # this allows parsing .osm files, too

    def startElement(self, name, attrs):
        if name in ["create","modify","delete"]:
            self.mode = name
        elif name in ["node","way","relation"]:
            self.attrs = attrs
            self.tags = {} # dict is okay here, original data has unique key
            if name == "way":
                self.nodes = []
            elif name == "relation":
                self.members = []
        elif name == "tag":
            self.tags[attrs["k"]] = attrs["v"]
        elif name == "nd":
            self.nodes.append(int(attrs["ref"]))
        elif name == "member":
            self.members.append((attrs["type"], int(attrs["ref"]), attrs["role"]))

    def endElement(self, name):
        if name in ["node","way","relation"]:
            id = int(self.attrs["id"])
            version = int(self.attrs["version"])
            timestamp = datetime.strptime(self.attrs["timestamp"], "%Y-%m-%dT%H:%M:%SZ")
            uid = self.attrs.get("uid", None)
            uid = int(uid) if uid is not None else None
            user = self.attrs.get("user", None)
            changeset = int(self.attrs["changeset"])

            if name == "node":
                lat = float(self.attrs["lat"])
                lon = float(self.attrs["lon"])
                self.consumer.node(self.mode, id, version, timestamp, uid, user, changeset, lat, lon, self.tags)
            elif name == "way":
                self.consumer.way(self.mode, id, version, timestamp, uid, user, changeset, self.nodes, self.tags)
            elif name == "relation":
                self.consumer.relation(self.mode, id, version, timestamp, uid, user, changeset, self.members, self.tags)


class Updater(object):
    '''
    Add changes to MonetDB database after checking existing data
    '''

    def __init__(self):
        self.db = monetdb.sql.connect(database=settings.DATABASE_NAME, username=settings.DATABASE_USER, password=settings.DATABASE_PASSWORD, hostname=settings.DATABASE_HOST)
        self.cursor = self.db.cursor()


    def node(self, mode, id, version, timestamp, uid, user, changeset, lat, lon, tags):
        if mode in ["create","modify"]:
            self.cursor.execute("SELECT COUNT(*) FROM nodes_legacy WHERE id=%d"%id)
            if self.cursor.fetchone()[0] == 0: # node does not exist
                self.cursor.execute("INSERT INTO nodes_legacy (id, long, lat, uid, timestamp, zcurve) VALUES (%d, %f, %f, %d, '%s', %d)"%(id, lon, lat, uid, timestamp, zcurve(lon, lat)))
            elif mode == "modify":
                self.cursor.execute("UPDATE nodes_legacy SET long=%f, lat=%f, uid=%d, timestamp='%s', zcurve=%d WHERE id=%d"%(lon, lat, uid, timestamp, zcurve(lon, lat), id))
                # delete tags, they will be reinserted
                self.cursor.execute("DELETE FROM node_tags WHERE node=%d"%id)
                ''' note that deletion and reinsertion will make the database size grow,
                    unless it is vacuumed (not supported yet) '''
            else:
                return # assume data exists, do not insert tags
            self.insert_tags("node", id, tags)

        elif mode == "delete":
            self.cursor.execute("DELETE FROM relation_members_node WHERE to_node=%d"%id)
            self.cursor.execute("DELETE FROM way_nds WHERE to_node=%d"%id)
            self.cursor.execute("DELETE FROM node_tags WHERE node=%d"%id)
            self.cursor.execute("DELETE FROM nodes_legacy WHERE id=%d"%id)


    def way(self, mode, id, version, timestamp, uid, user, changeset, nodes, tags):
        if mode in ["create", "modify"]:
            # check if all nodes exist
            self.cursor.execute("SELECT id FROM nodes_legacy WHERE id IN %s"%repr(nodes).replace("[","(").replace("]",")")) # nodes must be of type list
            existing_nodes = self.cursor.fetchall()
            missing_nodes = [node for node in nodes if node not in existing_nodes]
            if missing_nodes:
                if False and settings.fetch_missing:
                    # fetch missing nodes from API
                    url = "http://www.openstreetmap.org/api/0.6/way/%d/full"%id
                    # TODO download and parse XML, insert missing nodes
                    # What should happen if way version from API is newer than version from osmChange file%s
                    # Current API version might contain different nodes than current osmChange version.
                else:
                    # It might be good to log that this way was skipped.
                    return # do not insert way, nodes are missing

            self.cursor.execute("SELECT COUNT(*) FROM ways WHERE id=%d"%id)
            if self.cursor.fetchone()[0] == 0: # way does not exist
                self.cursor.execute("INSERT INTO ways (id, uid, timestamp) VALUES (%d,%d,'%s')"%(id, uid, timestamp))
            elif mode == "modify":
                self.cursor.execute("UPDATE ways SET uid=%d, timestamp='%s' WHERE id=%d"%(uid, timestamp, id))

                # delete old nodes because order matters (idx)
                self.cursor.execute("DELETE FROM way_nds WHERE way=%d"%id)

                # delete tags, they will be reinserted
                self.cursor.execute("DELETE FROM way_tags WHERE way=%d"%id)

                ''' note that deletion and reinsertion will make the database size grow,
                    unless it is vacuumed (not supported yet) '''
            else:
                return # assume data exists, do not insert way nodes and tags

            for idx in xrange(len(nodes)):
                self.cursor.execute("INSERT INTO way_nds (way, idx, to_node) VALUES (%d,%d,%d)"%(id, idx, nodes[idx]))

            self.insert_tags("way", id, tags)

        elif mode == "delete":
            self.cursor.execute("DELETE FROM relation_members_way WHERE to_way=%d"%id)
            self.cursor.execute("DELETE FROM way_nds WHERE way=%d"%id)
            self.cursor.execute("DELETE FROM way_tags WHERE way=%d"%id)
            self.cursor.execute("DELETE FROM ways WHERE id=%d"%id)

    def relation(self, mode, id, version, timestamp, uid, user, changeset, members, tags):
        if mode in ["create","modify"]:
            self.cursor.execute("SELECT COUNT(*) FROM relations WHERE id=%d"%id)
            if self.cursor.fetchone()[0] == 0: # relation does not exist
                self.cursor.execute("INSERT INTO relations (id, uid, timestamp) VALUES (%d,%d,'%s')"%(id, uid, timestamp))
            elif mode == "modify":
                self.cursor.execute("UPDATE relations SET uid=%d, timestamp='%s' WHERE id=%d"%(uid, timestamp, id))
                self.cursor.execute("DELETE FROM relation_members_node WHERE relation=%d"%id)
                self.cursor.execute("DELETE FROM relation_members_way WHERE relation=%d"%id)
                self.cursor.execute("DELETE FROM relation_tags WHERE relation=%d"%id)
            else:
                return # assume data exists, do not insert members and tags

            count = {"node":0, "way":0, "relation":0}
            for type, ref, role in members:
                # check for existing ref
                if type == "node":
                    self.cursor.execute("SELECT COUNT(*) FROM nodes_legacy WHERE id=%d"%ref)
                else:
                    self.cursor.execute("SELECT COUNT(*) FROM %ss WHERE id=%d"%(type, ref))
                if self.cursor.fetchone()[0] == 0: # relation does not exist
                    if False and settings.fetch_missing:
                        # fetch missing $type from API, insert
                        # TODO download and parse XML, insert missing $type
                        # for way and relation, fetch the full object and check for each node/member if it exists before inserting
                        pass
                    else:
                        '''It might be good to log that the current member was skipped.'''
                        continue # next member
                self.cursor.execute("INSERT INTO relation_members_%s (relation, idx, to_%s, role) VALUES (%d,%d,%d,'%s')"%(type,type, id, count[type], ref, role.encode('utf-8')))
                count[type] += 1
            self.insert_tags("relation", id, tags)

        elif mode == "delete":
            self.cursor.execute("DELETE FROM relation_members_relation WHERE to_relation=%d OR relation=%d"%(id, id))
            self.cursor.execute("DELETE FROM relation_members_node WHERE relation=%d"%id)
            self.cursor.execute("DELETE FROM relation_members_way WHERE relation=%d"%id)
            self.cursor.execute("DELETE FROM relation_tags WHERE relation=%d"%id)
            self.cursor.execute("DELETE FROM relations WHERE id=%d"%id)

    def insert_tags(self, type, id, tags):
        '''Preprocess given tags for one object of type node/way/relation with given id and insert the result in the database'''
        if type not in ["node","way","relation"]:
            raise Exception
        for k in tags:
            v = tags[k]
            # split values at semicolon, but exclude tags that contain real text
            if k != "note" and k[:11] != "description":
                v = v.replace("; ",";") # remove single space after semicolon
                values = v.split(";")
                for v in values:
                    self.cursor.execute(("INSERT INTO %s_tags (%s, k, v) VALUES (%d,'%s','%s')"%(type, type, id, k.replace("'","\'"), v.replace("'","\\'"))).encode('utf-8')) # ugly workaround, MonetDB accepts only utf-8 encoded strings
            else:
                self.cursor.execute(("INSERT INTO %s_tags (%s, k, v) VALUES (%d,'%s','%s')"%(type,type, id, k.replace("'","\'"), v.replace("'","\\'"))).encode('utf-8'))

    def __del__(self):
        self.db.commit()


if __name__ == "__main__":
    parser = xml.sax.make_parser()
    updater = Updater()
    handler = OSCReader(updater)
    parser.setContentHandler(handler)
    parser.parse(sys.stdin)
    del updater
