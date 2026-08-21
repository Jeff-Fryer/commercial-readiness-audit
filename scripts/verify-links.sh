#!/usr/bin/env bash
# verify-links.sh — audit jefffryer.com for links to retired pages.
#
# Reads the LIVE published site, never the Squarespace editor preview.
# Reports the href AND the anchor text of every "commercial" link, because
# href alone cannot detect the split-link failure (a link editor leaving the
# last character behind as its own anchor: "Commercial Audi" + "t").
#
# Usage:   ./scripts/verify-links.sh            # crawl the whole sitemap
#          ./scripts/verify-links.sh /some/path # crawl one page only
#
# Needs curl only. No Node, no Python, no browser.
# Do NOT crawl this site with in-page fetch() from the browser console: on a
# 34-page sitemap it timed out against the renderer twice (2026-08-21).

set -u

SITE="https://www.jefffryer.com"
AUDIT="/commercial-readiness-audit"
GOOD_BLOG="/blog/commercial-readiness-gap-diagnostic"
RETIRED_RE='^/(commercial-readiness-gap|commercial-gap)$'
ARCHIVE_RE='^/blog/(category|tag)/'

# Cache-buster: Squarespace and Safari both cache hard, and a stale 200 after
# an edit reads exactly like "the change did not land".
bust() { printf '%s?v=%s' "$1" "$(date +%s)$RANDOM"; }

fetch() { curl -sS --compressed --max-time 30 -H 'Cache-Control: no-cache' "$(bust "$SITE$1")"; }

hr() { printf '\n=== %s ===\n' "$1"; }

# ---------------------------------------------------------------- redirects
# Tasks 1 and 2. -L follows the chain; %{url_effective} is where it landed.
hr "REDIRECTS"
printf '%-6s %-34s %s\n' STATUS FROM 'LANDS ON'
for p in /commercial-readiness-gap /resources /commercial-gap "$AUDIT" "$GOOD_BLOG"; do
  read -r code url <<<"$(curl -sS -L -o /dev/null --max-time 30 \
    -w '%{http_code} %{url_effective}' "$(bust "$SITE$p")" 2>/dev/null)"
  # strip origin and the cache-buster back off for readability
  landed=${url#"$SITE"}; landed=${landed%%\?*}
  printf '%-6s %-34s %s\n' "${code:-ERR}" "$p" "${landed:-/}"
done
cat <<'NOTE'

Reading this block:
  404 on /commercial-readiness-gap  -> the URL Mapping (task 1) is NOT in place.
  /resources landing on the audit page proves nothing about task 2: once task 1
  exists, /resources reaches the audit page either directly or by chaining
  through it. Only the URL Mappings textarea settles task 2.
NOTE

# ---------------------------------------------------------------- link crawl
hr "COMMERCIAL LINKS"

if [ "$#" -ge 1 ]; then
  paths="$*"
else
  # grep -o puts each <loc> on its own line regardless of how the sitemap is
  # wrapped, so this survives a minified one-line sitemap. Do not go back to
  # `tr '>' '>\n'`: tr truncates SET2 to SET1's length, so that maps '>' to '>'
  # and inserts nothing. And match </loc> explicitly - a capture of [^<]* stops
  # at the '<', leaving the closing tag glued to every path.
  paths=$(fetch /sitemap.xml \
    | grep -o '<loc>[^<]*</loc>' \
    | sed -e 's|<loc>||' -e 's|</loc>||' \
    | sed -e 's|^https\{0,1\}://[^/]*||' -e 's|^$|/|' \
    | sort -u)
fi

count=$(printf '%s\n' $paths | grep -c .)
printf 'crawling %s pages\n\n' "$count"
printf '%-22s %-42s %s\n' FLAG PAGE 'HREF | ANCHOR TEXT'

for p in $paths; do
  html=$(fetch "$p") || { printf '%-22s %s\n' FETCHFAIL "$p"; continue; }

  # One anchor per line, then keep only the anchors whose href mentions
  # "commercial". Splitting on </a> first means the text can be recovered with
  # its inner markup intact, which matters: a link wrapped in <strong> must not
  # read as zero-length text and trip the split detector.
  printf '%s' "$html" \
    | tr -d '\n' \
    | sed 's|</a>|</a>\n|g' \
    | grep -E '<a[^>]+href="[^"]*[Cc]ommercial[^"]*"' \
    | sed 's|.*\(<a[^>]*href="[^"]*[Cc]ommercial[^"]*"[^>]*>\)|\1|' \
    | while IFS= read -r a; do
        href=$(printf '%s' "$a" | sed -n 's|^<a[^>]*href="\([^"]*\)".*|\1|p')
        # drop the opening tag, then ALL inner tags, then the closing tag
        text=$(printf '%s' "$a" \
               | sed -e 's|^<a[^>]*>||' -e 's|</a>.*||' -e 's|<[^>]*>||g' \
               | sed 's|&nbsp;| |g' \
               | tr -s ' \t' ' ' | sed -e 's|^ *||' -e 's| *$||')
        # normalise to a path: drop origin, query, fragment, trailing slash
        u=${href#"$SITE"}; u=${u#http*://*/}; u=${u%%\?*}; u=${u%%#*}
        case $u in /*) ;; *) u="/$u" ;; esac
        [ "$u" != "/" ] && u=${u%/}

        if   [ "$u" = "$AUDIT" ];     then flag=OK
        elif [ "$u" = "$GOOD_BLOG" ]; then flag=OK-BLOGSLUG
        elif printf '%s' "$u" | grep -qE "$RETIRED_RE"; then flag=STALE
        # Archive links are navigation, not content. /blog/category/Commercial+Readiness
        # is a real Squarespace URL and matched the typo check ~40 times, burying
        # the rows that mattered.
        elif printf '%s' "$u" | grep -qE "$ARCHIVE_RE"; then flag=OK-ARCHIVE
        else flag=UNKNOWN-TYPO?
        fi

        # split-link detector, and empty text = nested markup or a bare icon
        [ "${#text}" -le 2 ] && flag="$flag+SPLIT?"

        printf '%-22s %-42s %s | "%s"\n' "$flag" "$p" "$u" "$text"
      done
done

cat <<'NOTE'

Reading this block:
  STALE          a link still pointing at a retired page. Repoint it.
  UNKNOWN-TYPO?  an href containing "commercial" that matches no known page.
                 This is the check that catches /commercial-readiness-audt.
  +SPLIT?        anchor text of 2 characters or fewer. Two OK lines on one page
                 with texts like "Commercial Audi" and "t" is one broken link,
                 not two good ones.
  OK-BLOGSLUG    /blog/commercial-readiness-gap-diagnostic. Leave alone: it is a
                 blog slug that merely contains the phrase, not the retired page.
NOTE
