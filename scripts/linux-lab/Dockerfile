# Imagen del laboratorio Linux real (Alpine 32 bits) que corre en el navegador con v86.
# Construir: bash scripts/linux-lab/build.sh
FROM docker.io/i386/alpine:3.21.0

RUN apk add --no-cache openrc alpine-base agetty alpine-conf linux-virt linux-firmware-none \
    git bash nano less ncurses-terminfo-base

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

COPY bashrc /home/alumno/.bashrc
COPY motd /etc/motd
RUN chown -R alumno:alumno /home/alumno /srv/github \
 && echo 'source ~/.bashrc' > /home/alumno/.bash_profile && chown alumno:alumno /home/alumno/.bash_profile

RUN for i in devfs dmesg mdev hwdrivers; do rc-update add $i sysinit; done \
 && for i in hwclock modules sysctl hostname bootmisc; do rc-update add $i boot; done \
 && rc-update add killprocs shutdown \
 && mkinitfs -F "base virtio 9p" $(cat /usr/share/kernel/virt/kernel.release) \
 && rm -rf /var/cache/apk/* /usr/share/man /usr/share/doc
