#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"

load_env_var() {
  local var_name="$1"
  local default_value="$2"
  
  if [[ ! -f "$ENV_FILE" ]]; then
    printf '%s' "$default_value"
    return
  fi
  
  local parsed
  parsed="$(sed -n "s/^[[:space:]]*$var_name[[:space:]]*=[[:space:]]*//p" "$ENV_FILE" | tail -n 1)"
  
  # Strip trailing inline comments
  parsed="${parsed%%[[:space:]]#*}"
  
  # Trim leading/trailing spaces
  parsed="$(printf '%s' "$parsed" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  
  # Remove surrounding matching quotes
  if [[ "$parsed" == \"*\" && "$parsed" == *\" ]]; then
    parsed="${parsed:1:${#parsed}-2}"
  elif [[ "$parsed" == \'*\' && "$parsed" == *\' ]]; then
    parsed="${parsed:1:${#parsed}-2}"
  fi
  
  if [[ -n "$parsed" ]]; then
    printf '%s' "$parsed"
  else
    printf '%s' "$default_value"
  fi
}

BASE_URL="$(load_env_var "BASE_URL" "http://localhost:2626")"
OUT_DIR="${OUT_DIR:-$PROJECT_ROOT/tmp}"
OUT_FILE="${OUT_FILE:-$OUT_DIR/local-test.pdf}"
FILENAME="${FILENAME:-local-test}"
HTML_FILE="${HTML_FILE:-}"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"

usage() {
  echo "Usage: $0 [-u <base-url>] [-o <output-file>] [-f <html-file|filename>] [-n <filename>]"
  echo "AUTH_PASSWORD is loaded from $ENV_FILE"
  echo "Examples:"
  echo "  $0 -f ./scripts/html/apex-report-operations.html -o ./tmp/operations.pdf"
  echo "  $0 -n my-report -o ./tmp/my-report.pdf"
}

resolve_html_file() {
  local input="$1"

  if [[ "$input" = /* && -f "$input" ]]; then
    printf '%s' "$input"
    return 0
  fi

  if [[ -f "$input" ]]; then
    printf '%s' "$input"
    return 0
  fi

  if [[ -f "$PROJECT_ROOT/$input" ]]; then
    printf '%s' "$PROJECT_ROOT/$input"
    return 0
  fi

  if [[ -f "$SCRIPT_DIR/$input" ]]; then
    printf '%s' "$SCRIPT_DIR/$input"
    return 0
  fi

  return 1
}

load_auth_password_from_env_file() {
  if [[ ! -f "$ENV_FILE" ]]; then
    return
  fi

  local parsed
  parsed="$(sed -n 's/^[[:space:]]*AUTH_PASSWORD[[:space:]]*=[[:space:]]*//p' "$ENV_FILE" | tail -n 1)"

  # Strip trailing inline comments like: value # comment
  parsed="${parsed%%[[:space:]]#*}"

  # Trim leading/trailing spaces
  parsed="$(printf '%s' "$parsed" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

  # Remove surrounding matching quotes
  if [[ "$parsed" == \"*\" && "$parsed" == *\" ]]; then
    parsed="${parsed:1:${#parsed}-2}"
  elif [[ "$parsed" == \'*\' && "$parsed" == *\' ]]; then
    parsed="${parsed:1:${#parsed}-2}"
  fi

  if [[ -n "$parsed" ]]; then
    AUTH_PASSWORD="$parsed"
  fi
}

while getopts ":u:o:f:n:h" opt; do
  case "$opt" in
    u)
      BASE_URL="$OPTARG"
      ;;
    o)
      OUT_FILE="$OPTARG"
      ;;
    f)
      # Backward-compatible: if -f points to a real file, treat as HTML input;
      # otherwise keep old behavior and treat it as output filename.
      if resolved_html="$(resolve_html_file "$OPTARG")"; then
        HTML_FILE="$resolved_html"
      else
        FILENAME="$OPTARG"
      fi
      ;;
    n)
      FILENAME="$OPTARG"
      ;;
    h)
      usage
      exit 0
      ;;
    :)
      echo "Error: -$OPTARG requires a value"
      usage
      exit 1
      ;;
    \?)
      echo "Error: Invalid option -$OPTARG"
      usage
      exit 1
      ;;
  esac
done

load_auth_password_from_env_file

if [[ -z "${AUTH_PASSWORD:-}" ]]; then
  echo "Error: AUTH_PASSWORD is required in $ENV_FILE"
  usage
  exit 1
fi

mkdir -p "$(dirname -- "$OUT_FILE")"

AUTH_PAYLOAD="$(jq -n --arg password "$AUTH_PASSWORD" '{ password: $password }')"
AUTH_RESPONSE="$(curl -sS -X POST "$BASE_URL/authenticate" \
  -H "Content-Type: application/json" \
  --data "$AUTH_PAYLOAD")"

TOKEN="$(printf '%s' "$AUTH_RESPONSE" | jq -r '.token // empty')"
if [[ -z "$TOKEN" ]]; then
  echo "Authentication failed"
  printf '%s\n' "$AUTH_RESPONSE" | jq . 2>/dev/null || printf '%s\n' "$AUTH_RESPONSE"
  exit 1
fi

if [[ -n "$HTML_FILE" ]]; then
  RENDER_PAYLOAD="$(jq -n --rawfile html "$HTML_FILE" --arg filename "$FILENAME" '{ html: $html, filename: $filename }')"
else
  RENDER_PAYLOAD="$(jq -n --arg html '<html><body><h1>Hello from FastPDF</h1><p>This PDF was generated locally.</p></body></html>' --arg filename "$FILENAME" '{ html: $html, filename: $filename }')"
fi

printf '%s\n' "Rendering PDF from HTML..."
if [[ -n "$HTML_FILE" ]]; then
  printf '%s\n' "Using HTML file: $HTML_FILE"
fi

HTTP_CODE="$(curl -sS -X POST "$BASE_URL/pdf-render" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/pdf" \
  --data "$RENDER_PAYLOAD" \
  --output "$OUT_FILE" \
  --write-out '%{http_code}')"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "Render failed with HTTP $HTTP_CODE"
  rm -f "$OUT_FILE"
  exit 1
fi

echo "Saved PDF to: $OUT_FILE"
ls -lh "$OUT_FILE"
