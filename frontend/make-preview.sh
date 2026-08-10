#!/bin/bash
# Builds frontend/preview.html: the Code Block wrapped in a minimal host page so
# it can be opened and clicked through locally.
#
# preview.html is generated and gitignored — never edit it, and never paste it
# into Squarespace. The paste artifact is commercial-readiness-code-block.html.
#
#   ./frontend/make-preview.sh          build it
#   ./frontend/make-preview.sh --open   build it and open in your browser

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
BLOCK="$DIR/commercial-readiness-code-block.html"
OUT="$DIR/preview.html"

{
cat <<'HEAD'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LOCAL PREVIEW — Commercial Readiness Assessment</title>
<style>
  /* Host page only. Approximates a Squarespace page around the Code Block;
     none of this ships. */
  body{margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;}
  .preview-bar{background:#1E2C45;color:#93A1B8;font-size:12px;letter-spacing:.08em;
    text-transform:uppercase;padding:10px 16px;text-align:center;}
  .preview-bar b{color:#fff;}
  .page{padding:40px 16px 80px;}
</style>
</head>
<body>
<div class="preview-bar"><b>Local preview</b> — host page is simulated; the block below is the real artifact</div>
<div class="page">
HEAD

cat "$BLOCK"

cat <<'FOOT'
</div>
</body>
</html>
FOOT
} > "$OUT"

echo "built: $OUT"
[ "$1" = "--open" ] && open "$OUT"
exit 0
