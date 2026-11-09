#!/usr/bin/env bash
# Cosmetic: Vice-palette banner when a subagent starts. Never blocks (always exit 0).
agent=$(node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.agent_type||j.agent_name||'agent')}catch{console.log('agent')}})")

case "$agent" in
  data-agent)     r=45;  g=226; b=200 ;; # teal   #2DE2C8
  analyst-agent)  r=255; g=209; b=102 ;; # gold   #FFD166
  builder-agent)  r=255; g=61;  b=139 ;; # pink   #FF3D8B
  report-agent)   r=255; g=159; b=67  ;; # orange #FF9F43
  reviewer-agent) r=69;  g=196; b=249 ;; # sky    #45C4F9
  *)              r=185; g=167; b=230 ;; # lilac  #B9A7E6
esac

printf "\e[38;2;%d;%d;%dm" "$r" "$g" "$b"
printf '%s\n' \
  "▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄" \
  "█ X MILLAS ▶ ${agent} █" \
  "▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀"
printf "\e[0m"
exit 0