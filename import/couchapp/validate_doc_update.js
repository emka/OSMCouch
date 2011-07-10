function (newDoc, oldDoc, userCtx) {
    if (!userCtx.name) {
        throw({unauthorized:'Please log in.'});
    }
    if (userCtx.roles.indexOf('_admin') == -1) { // not an admin
        if (userCtx.roles.indexOf('osmcouch') == -1)
        {
            throw({forbidden:'You have no permission to modify documents.'});
        }
    }
}
