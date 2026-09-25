# Laboratorio Dev101x: se carga en la terminal al arrancar (lab.js lo copia a /tmp y lo ejecuta con ".").
# Tras cada comando avisa a la página (secuencia OSC 7777, invisible en la terminal) del comando, su código
# de salida y el estado del repositorio. Así el aula cuenta el progreso con lo que de verdad ha pasado.
# Formato: 1|codigo|comando(base64)|carpeta(base64)|repo|rama|commits|upstream|conflictos|primer-commit
# Además, tras cada comando guarda en segundo plano una copia del trabajo (OSC 7778 cuando está lista) para
# que el aula la devuelva al recargar la página.

# La pista del curso usa github.com/tu-usuario/...: apunta al mismo "GitHub" local que alumno/.
[ -e /srv/github/tu-usuario ] || ln -s alumno /srv/github/tu-usuario 2>/dev/null

# Escenario del curso (lo escribe el aula con datos del contenido, p. ej. DEV101X_PR=7).
[ -f /tmp/.dev101x-scenario ] && . /tmp/.dev101x-scenario

# La copia (tar de ~/ y del "GitHub" local) cuesta ~2 s de CPU emulada: se hace en segundo plano, 3 s después
# del último comando (si mientras tanto se escribe otro, espera a ese) y nunca dos a la vez.
__dev101x_gen=0
__dev101x_save() {
  printf '%s\n' "$PWD" > "$HOME/.dev101x-pwd"
  __dev101x_gen=$((__dev101x_gen + 1))
  printf '%s' "$__dev101x_gen" > /tmp/.dev101x-gen
  local g=$__dev101x_gen
  ( (
    sleep 3
    [ "$(cat /tmp/.dev101x-gen 2>/dev/null)" = "$g" ] || exit 0
    mkdir /tmp/.dev101x-lock 2>/dev/null || exit 0
    t=/tmp/.dev101x-save.$BASHPID
    tar czf "$t" -C / home/alumno srv/github 2>/dev/null && mv -f "$t" /tmp/.dev101x-save.tgz \
      && printf '\033]7778;saved\007'
    rm -f "$t"
    rmdir /tmp/.dev101x-lock
  ) & )
}

__dev101x_b64() { printf %s "$1" | base64 | tr -d '\n'; }

# Comandos ejecutados desde el último prompt, tal como se escribieron (la trampa DEBUG salta antes de cada
# comando simple; no depende del historial). "a && b" llega como "a && b".
__dev101x_cmds=''
__dev101x_trap() {
  [ "$BASH_COMMAND" = __dev101x_state ] && return
  __dev101x_cmds="${__dev101x_cmds:+$__dev101x_cmds && }$BASH_COMMAND"
}

__dev101x_state() {
  local rc=$? cmd="$__dev101x_cmds" branch='' upstream='' commits=0 conflict=0 repo=0 root='' line st
  __dev101x_cmds=''
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    repo=1
    # Repo del equipo recién clonado: su rama feature/titulo queda también en local (una sola vez), para que
    # "git merge feature/titulo" funcione como en la lección.
    if [ "${PWD##*/}" = proyecto-equipo ] && [ ! -e .git/.dev101x-titulo ]; then
      git show-ref -q --verify refs/remotes/origin/feature/titulo \
        && git branch -q feature/titulo origin/feature/titulo 2>/dev/null
      : > .git/.dev101x-titulo
    fi
    # Sin /dev/fd en esta máquina: nada de "< <(...)"; el here-string usa un archivo temporal.
    st=$(git status --porcelain=v2 --branch 2>/dev/null)
    while IFS= read -r line; do
      case $line in
        '# branch.head '*) branch=${line#'# branch.head '} ;;
        '# branch.upstream '*) upstream=${line#'# branch.upstream '} ;;
        'u '*) conflict=$((conflict + 1)) ;;
      esac
    done <<< "$st"
    commits=$(git rev-list --count HEAD 2>/dev/null || echo 0)
    # Hash del primer commit del repo (solo tras un commit: es otra llamada a git).
    case $cmd in *commit*) root=$(git rev-list --max-parents=0 HEAD 2>/dev/null | tail -n 1) ;; esac
  fi
  printf '\033]7777;1|%s|%s|%s|%s|%s|%s|%s|%s|%s\007' "$rc" "$(__dev101x_b64 "$cmd")" "$(__dev101x_b64 "${PWD##*/}")" \
    "$repo" "$branch" "$commits" "$upstream" "$conflict" "$root"
  # Solo se guarda copia tras comandos que pueden cambiar algo.
  case $cmd in
    ''|clear*|ls|ls\ *|pwd|git\ status*|git\ log*|git\ diff*|git\ show*|help*) ;;
    *) __dev101x_save ;;
  esac
  return $rc
}

# Herramientas de GitHub sin conexión (en la máquina no hay red): se comportan como las reales.
ssh-keygen() {
  local f="$HOME/.ssh/id_ed25519" c=''
  while [ $# -gt 0 ]; do
    case $1 in -C) c=$2; shift ;; -f) f=$2; shift ;; esac
    shift
  done
  mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
  echo 'Generating public/private ed25519 key pair.'
  printf -- '-----BEGIN OPENSSH PRIVATE KEY-----\n%s\n-----END OPENSSH PRIVATE KEY-----\n' \
    "$(head -c 180 /dev/urandom | base64 | tr -d '\n')" > "$f" && chmod 600 "$f"
  printf 'ssh-ed25519 %s %s\n' "$(head -c 32 /dev/urandom | base64 | tr -d '\n')" "$c" > "$f.pub"
  echo "Your identification has been saved in $f"
  echo "Your public key has been saved in $f.pub"
  echo '(Laboratorio: clave de práctica, no sale de esta máquina)'
}

ssh() {
  if [ "$1" = -T ] && [ "${2#*@}" = github.com ]; then
    if [ -f "$HOME/.ssh/id_ed25519.pub" ]; then
      echo "Hi alumno! You've successfully authenticated, but GitHub does not provide shell access."
      return 1
    fi
    echo 'git@github.com: Permission denied (publickey).'
    return 255
  fi
  echo 'ssh: en este laboratorio solo funciona "ssh -T git@github.com"'
  return 255
}

gh() {
  if [ "$1 $2" != 'pr create' ]; then
    echo 'gh: en este laboratorio solo funciona "gh pr create"'
    return 1
  fi
  local b
  b=$(git branch --show-current 2>/dev/null) || { echo 'failed to run git: not a git repository'; return 1; }
  if [ -z "$b" ] || [ "$b" = main ]; then
    echo 'pull request create failed: crea una rama con tus cambios (git switch -c ...) y súbela'
    return 1
  fi
  if ! git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
    echo "aborted: you must first push the current branch to a remote, or use the --head flag"
    return 1
  fi
  echo "Creating pull request for $b into main in dev101x-lab/proyecto-equipo"
  echo
  echo "https://github.com/dev101x-lab/proyecto-equipo/pull/${DEV101X_PR:-1}"
}

PROMPT_COMMAND=__dev101x_state
trap __dev101x_trap DEBUG
