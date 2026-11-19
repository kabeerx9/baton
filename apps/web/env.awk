# BusyBox/POSIX awk only: the standalone nginx image has no Node.js runtime.
function json(value,    result, i, ch) {
    result = "\""
    for (i = 1; i <= length(value); i++) {
        ch = substr(value, i, 1)
        if (ch in escape) result = result escape[ch]
        else result = result ch
    }
    return result "\""
}

# https://<public key>@<host>[:port][/path]/<project id>. No {n,m} intervals:
# BusyBox awk in the image must accept every expression here.
function valid_dsn(value) {
    if (value ~ /^https:\/\/[A-Za-z0-9]+@[A-Za-z0-9.-]+(:[0-9]+)?(\/[A-Za-z0-9._-]+)*\/[0-9]+$/ && length(value) <= 512)
        return value
    return ""
}

function valid_environment(value) {
    if (value ~ /^[A-Za-z0-9_.-]+$/ && length(value) <= 64) return value
    return ""
}

BEGIN {
    escape["\\"] = "\\\\"
    escape["\""] = "\\\""
    for (i = 1; i < 32; i++) escape[sprintf("%c", i)] = sprintf("\\u%04x", i)
    # Only these public build-time placeholders may enter browser assets.
    values["BATON_API_URL"] = ENVIRON["BATON_API_URL"]
    values["BATON_CLIENT_URL"] = ENVIRON["BATON_CLIENT_URL"]
    values["BATON_TURNSTILE_SITE_KEY"] = ENVIRON["BATON_TURNSTILE_SITE_KEY"]
    # Sentry values are public too, but only a well-formed value is written;
    # anything else renders empty and leaves browser Sentry off.
    values["BATON_SENTRY_DSN"] = valid_dsn(ENVIRON["BATON_SENTRY_DSN"])
    values["BATON_SENTRY_ENVIRONMENT"] = valid_environment(ENVIRON["BATON_SENTRY_ENVIRONMENT"])

    if (mode == "check") {
        if (ENVIRON["BATON_SENTRY_DSN"] != "" && values["BATON_SENTRY_DSN"] == "")
            print "WARNING: BATON_SENTRY_DSN is not an https Sentry DSN, so browser error reporting stays off."
        if (ENVIRON["BATON_SENTRY_ENVIRONMENT"] != "" && values["BATON_SENTRY_ENVIRONMENT"] == "")
            print "WARNING: BATON_SENTRY_ENVIRONMENT may use only letters, digits, dot, dash and underscore (64 at most); it is ignored."
        exit
    }

    if (mode == "resource" || mode == "authorization") {
        base = values["BATON_API_URL"]
        if (base == "") { print "{}"; exit }
        sub(/[?#].*$/, "", base)
        sub(/\/*$/, "", base)
        sub(/\/api$/, "", base)
        if (mode == "resource") {
            print "{\"resource\":" json(base "/api/mcp") ",\"authorization_servers\":[" json(base "/api") "]}"
        } else {
            print "{\"issuer\":" json(base "/api") ",\"authorization_endpoint\":" json(base "/api/mcp/authorize") ",\"token_endpoint\":" json(base "/api/mcp/token") ",\"registration_endpoint\":" json(base "/api/mcp/register") ",\"response_types_supported\":[\"code\"],\"grant_types_supported\":[\"authorization_code\"],\"code_challenge_methods_supported\":[\"S256\"],\"token_endpoint_auth_methods_supported\":[\"none\"]}"
        }
        exit
    }
}

{
    rest = $0
    output = ""
    # Match entire quoted literals. The emitted JSON string is never scanned
    # again, so a value containing another placeholder remains literal data.
    # Vite can fold a static path suffix into the same literal (for example
    # BATON_CLIENT_URL/auth/sign-in). Only accept an unescaped static path.
    while (match(rest, /["'`]BATON_(API_URL|CLIENT_URL|TURNSTILE_SITE_KEY|SENTRY_DSN|SENTRY_ENVIRONMENT)(\/[-A-Za-z0-9_.\/]*)?["'`]/)) {
        token = substr(rest, RSTART, RLENGTH)
        key = substr(token, 2, length(token) - 2)
        suffix = ""
        slash = index(key, "/")
        if (slash) { suffix = substr(key, slash); key = substr(key, 1, slash - 1) }
        output = output substr(rest, 1, RSTART - 1)
        # A path suffix only makes sense on the URL placeholders.
        if (suffix != "" && key ~ /^BATON_SENTRY_/) output = output token
        else if (substr(token, 1, 1) == substr(token, length(token), 1)) output = output json(values[key] suffix)
        else output = output token
        rest = substr(rest, RSTART + RLENGTH)
    }
    print output rest
}
