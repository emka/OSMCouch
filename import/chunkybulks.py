#!/usr/bin/env python

import sys
import urllib2
import simplejson as json
from ijson import items

def send_req(dbname, docs):
    data = '{"docs": [' + ','.join(docs) + ']}'
    req = urllib2.Request('{0}/_bulk_docs'.format(dbname), data.encode('utf-8'), {'Content-Type': 'application/json'})
    resp = urllib2.urlopen(req)

    ## Response needs to be read, else the script doesn't wait until the
    ## request is finished (it goes on after the first chunk is received)
    resp.read()

def main():
    if len(sys.argv) != 3:
        print('usage: {0} bulk.json http://localhost:5984/my_db'.format(sys.argv[0]))
        return
    FILE = sys.argv[1]
    DB_NAME = sys.argv[2]
    print('Uploading to {0}'.format(DB_NAME))
    bulksize = 10000
    f = open(FILE, 'r')

    doc_count = 0
    batch_count = 0
    docs = []
    for doc in items(f, 'docs.item'):
        docs.append(json.dumps(doc, use_decimal=True))
        doc_count += 1
        if doc_count == bulksize:
            send_req(DB_NAME, docs)
            doc_count = 0
            docs = []
            print('finished batch: {0}'.format(batch_count))
            batch_count += 1

    # send remaining docs (if any)
    if len(docs) > 0:
        send_req(DB_NAME, docs)

if __name__ == '__main__':
    main()
