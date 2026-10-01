#!/bin/sh
# Escenario del curso de Linux (se ejecuta al construir la imagen): el servidor web ficticio de Ejemplo Lab
# tiene un incidente. Todo es inventado: IP de los rangos de documentación (192.0.2.x, 198.51.100.x,
# 203.0.113.x), que no pertenecen a nadie, y un "programa sospechoso" que solo escucha en un puerto local.
set -e

# Usuarios: una empleada, el usuario del servicio web y una puerta trasera con UID 0 (como root).
adduser -D -s /bin/bash -g 'Ana Torres' ana
adduser -S -D -H -h /var/www -s /sbin/nologin -g 'Servicio web' web
echo 'soporte:x:0:0:Soporte tecnico:/root:/bin/sh' >> /etc/passwd
echo 'soporte:!:20359:0:::::' >> /etc/shadow

# La web: config.ini con permisos 666 (cualquiera la lee y la cambia) y una copia oculta olvidada.
W=/var/www/ejemplo-lab
mkdir -p $W/uploads
cat > $W/index.html <<'EOF'
<!doctype html>
<title>Ejemplo Lab S.A.</title>
<h1>Ejemplo Lab S.A.</h1>
<p>Web corporativa (laboratorio Dev101x: datos ficticios).</p>
EOF
cat > $W/config.ini <<'EOF'
[base_de_datos]
host = 127.0.0.1
nombre = ejemplolab
usuario = ejemplolab_app
contrasena = Verano2026!
EOF
cp $W/config.ini $W/.config.ini.bak
printf 'Sitio de Ejemplo Lab S.A.\nDespliegue: copiar los archivos a /var/www/ejemplo-lab\n' > $W/LEEME.txt
chown -R alumno:alumno /var/www/ejemplo-lab
chmod 755 $W && chmod 644 $W/index.html $W/LEEME.txt $W/.config.ini.bak && chmod 666 $W/config.ini && chmod 777 $W/uploads

# Registro de accesos SSH: fuerza bruta desde 203.0.113.45 que acaba entrando con la cuenta alumno.
L=/var/log/auth.log
: > $L
line() { printf 'Sep 29 %s servidor sshd[%s]: %s\n' "$1" "$2" "$3" >> $L; }
line 01:02:11 701 'Accepted publickey for alumno from 192.0.2.50 port 50112 ssh2'
i=0; for s in 05 17 29 41 53; do i=$((i + 1)); line 02:1$i:$s 72$i "Failed password for root from 198.51.100.7 port 4410$i ssh2"; done
i=0; for s in 03 19 36; do i=$((i + 1)); line 02:3$i:$s 74$i "Failed password for admin from 192.0.2.10 port 3301$i ssh2"; done
line 02:40:00 750 'Failed password for admin from 198.51.100.7 port 44120 ssh2'
line 02:40:12 751 'Failed password for admin from 198.51.100.7 port 44121 ssh2'
m=0
for u in root root root admin root alumno root test root alumno root root admin root alumno root oracle root alumno root \
         root admin root alumno root root test root alumno root root root alumno root admin alumno root alumno; do
  m=$((m + 1)); mm=$(printf '%02d' $((m % 60))); ss=$(printf '%02d' $(((m * 7) % 60)))
  line 03:$mm:$ss $((800 + m)) "Failed password for $u from 203.0.113.45 port $((51000 + m)) ssh2"
done
line 03:47:52 870 'Accepted password for alumno from 203.0.113.45 port 51099 ssh2'
line 03:48:30 871 'pam_unix(sshd:session): session opened for user alumno(uid=1000) by alumno(uid=0)'
line 03:52:14 899 'Failed password for root from 198.51.100.7 port 44130 ssh2'
line 03:52:20 900 'Failed password for root from 198.51.100.7 port 44131 ssh2'
line 08:15:40 950 'Accepted publickey for alumno from 192.0.2.50 port 50240 ssh2'
chmod 644 $L

# El programa sospechoso: un netcat renombrado como "kworkerd" (imita a un proceso del kernel) que escucha
# en el puerto 4444. Arranca con la máquina (servicio local) y una tarea programada lo vuelve a lanzar.
mkdir -p /var/tmp/.cache
cp "$(readlink -f /usr/bin/nc)" /var/tmp/.cache/kworkerd
chown -R alumno:alumno /var/tmp/.cache && chmod 755 /var/tmp/.cache/kworkerd
cat > /etc/local.d/kworkerd.start <<'EOF'
#!/bin/sh
su -s /bin/sh alumno -c '/var/tmp/.cache/kworkerd -lk 4444 >/dev/null 2>&1 &'
EOF
chmod 755 /etc/local.d/kworkerd.start
rc-update add local default
echo '*/5 * * * * /var/tmp/.cache/kworkerd -lk 4444 >/dev/null 2>&1' > /etc/crontabs/alumno
chown alumno:alumno /etc/crontabs/alumno && chmod 600 /etc/crontabs/alumno

# ss vive en /sbin; así funciona también en sesiones cuyo PATH no incluye /sbin.
[ -e /usr/bin/ss ] || ln -s /sbin/ss /usr/bin/ss
