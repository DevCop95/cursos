# Imagen del laboratorio Linux real (Alpine 32 bits) que corre en el navegador con v86.
# Construir: bash scripts/linux-lab/build.sh

# Fase "caso": genera las pruebas ficticias del curso de OSINT (fotos con metadatos, PDF, perfiles).
# ImageMagick solo se usa aquí; la imagen final recibe los archivos ya hechos.
FROM docker.io/i386/alpine:3.21.0 AS caso
RUN apk add --no-cache imagemagick imagemagick-jpeg exiftool
COPY setup-osint.sh caso-propuesta.pdf /tmp/
RUN sh /tmp/setup-osint.sh

# Fase "gitleaks": compila Gitleaks para 32 bits con las expresiones regulares de Go. Los binarios oficiales
# usan go-re2 (WebAssembly), que en 32 bits se interpreta y tarda ~15 s en arrancar; así arranca en 0,15 s.
FROM docker.io/library/golang:1.24-alpine AS gitleaks
RUN apk add --no-cache git \
 && git clone -q --depth 1 --branch v8.30.1 https://github.com/gitleaks/gitleaks /src \
 && cd /src && CGO_ENABLED=0 GOOS=linux GOARCH=386 go build -trimpath \
    -ldflags "-s -w -X github.com/zricethezav/gitleaks/v8/version.Version=8.30.1" -o /gitleaks .

FROM docker.io/i386/alpine:3.21.0

RUN apk add --no-cache openrc alpine-base agetty alpine-conf linux-virt linux-firmware-none \
    git bash nano less ncurses-terminfo-base \
    exiftool jq file \
    procps-ng iproute2-ss netcat-openbsd

RUN setup-hostname dev101x-lab \
 && adduser -D -s /bin/bash alumno \
 && passwd -d alumno && passwd -d root \
 && sed -i '/^tty[0-9]/d' /etc/inittab \
 && echo 'ttyS0::respawn:/sbin/agetty --autologin alumno --noclear -s ttyS0 115200 xterm-256color' >> /etc/inittab

# "GitHub" sin conexión: las URLs de github.com apuntan a repos locales.
RUN git config --system init.defaultBranch main \
 && git config --system url."/srv/github/".insteadOf "https://github.com/" \
 && git config --system --add url."/srv/github/".insteadOf "git@github.com:" \
 && git config --system core.editor nano \
 && git config --system color.ui auto \
 && git config --system core.pager "less -FRX"

COPY setup-lab.sh /tmp/setup-lab.sh
RUN sh /tmp/setup-lab.sh && rm /tmp/setup-lab.sh

# Curso de OSINT: el caso (solo lectura en /srv/osint/caso) y sherlock/holehe de laboratorio (sin conexión).
COPY --from=caso /srv/osint /srv/osint
COPY osint-tools/sherlock osint-tools/holehe /usr/local/bin/
RUN chmod 755 /usr/local/bin/sherlock /usr/local/bin/holehe

# Curso de Linux: servidor web ficticio con un incidente (usuarios, permisos, log SSH, proceso y tarea).
COPY setup-linux.sh /tmp/setup-linux.sh
RUN sh /tmp/setup-linux.sh && rm /tmp/setup-linux.sh

# Curso de seguridad para desarrolladores: Gitleaks y el repositorio ejemplo-lab/tienda-api en el "GitHub" local.
COPY --from=gitleaks /gitleaks /usr/local/bin/gitleaks
COPY gitleaks-lab.toml /etc/gitleaks/laboratorio.toml
COPY setup-devsec.sh /tmp/setup-devsec.sh
RUN sh /tmp/setup-devsec.sh && rm /tmp/setup-devsec.sh

COPY bashrc /home/alumno/.bashrc
COPY motd /etc/motd
RUN chown -R alumno:alumno /home/alumno /srv/github \
 && echo 'source ~/.bashrc' > /home/alumno/.bash_profile && chown alumno:alumno /home/alumno/.bash_profile

RUN for i in devfs dmesg mdev hwdrivers; do rc-update add $i sysinit; done \
 && for i in hwclock modules sysctl hostname bootmisc; do rc-update add $i boot; done \
 && rc-update add killprocs shutdown \
 && mkinitfs -F "base virtio 9p" $(cat /usr/share/kernel/virt/kernel.release) \
 && rm -rf /var/cache/apk/* /usr/share/man /usr/share/doc
