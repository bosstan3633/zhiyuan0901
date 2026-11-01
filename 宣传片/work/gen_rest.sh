set -e
gen() {
  local name="$1"; local prompt="$2"
  cat > /tmp/g_$name.json <<EOF
{"model":"MiniMax-Hailuo-2.3","prompt":$prompt,"duration":10,"resolution":"768P","ratio":"16:9"}
EOF
  echo -n "$name → "
  mcode-tools connector call connector__matrix__submit_video_generation --args-file /tmp/g_$name.json 2>/dev/null | sed -n '/^{/,$p' | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('task_id') or d)"
  sleep 6
}
