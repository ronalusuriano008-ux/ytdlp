#!/data/data/com.termux/files/usr/bin/bash

OUTPUT="estructura.txt"

{
  echo "."
  find . \
    -type d \( -name node_modules -o -name .git \) -prune -o \
    -print | sed 's#^\./##' | sort | awk '
    BEGIN {
      FS="/"
    }
    {
      if ($0 == ".") next
      indent=""
      for (i=1; i<NF; i++) {
        indent=indent "│   "
      }
      print indent "├── " $NF
    }'
} > "$OUTPUT"

echo "Árbol guardado en: $OUTPUT"