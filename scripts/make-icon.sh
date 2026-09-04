#!/bin/sh
set -eu
cd "$(dirname "$0")/../assets"

gradient() { magick -size 1024x1024 -define gradient:angle=160 gradient:'#A58BFF-#6E4BC7' "$@"; }
key() {
  scale=$(echo "$1 / 24" | bc -l); offset=$(echo "(1024 - $1) / 2" | bc -l)
  echo "translate $offset,$offset scale $scale,$scale stroke-linecap round stroke-linejoin round circle 8,15 12,15 path 'M11 12l8.5-8.5M16 7l2.5 2.5M14 9l2 2'"
}

gradient -fill none -stroke white -strokewidth 2 -draw "$(key 512)" -alpha off -depth 8 PNG24:icon.png
gradient -alpha off -depth 8 PNG24:adaptive-background.png
magick -size 1024x1024 xc:none -fill none -stroke white -strokewidth 2 -draw "$(key 344)" -depth 8 PNG32:adaptive-foreground.png
