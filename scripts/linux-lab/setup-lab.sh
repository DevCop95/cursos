#!/bin/sh
# Prepara los repos del laboratorio (se ejecuta al construir la imagen).
set -e
EQ="-c user.name=Equipo_Dev101x -c user.email=equipo@dev101x.lab"

# Tu primer proyecto: una carpeta con README.md que aún no es repositorio.
mkdir -p /home/alumno/hola-git
printf '# Hola Git\nProyecto de prueba\n' > /home/alumno/hola-git/README.md

# Repositorio vacío en el "GitHub" local para subir hola-git.
mkdir -p /srv/github/alumno
git init -q --bare /srv/github/alumno/hola-git.git

# Repositorio del equipo con una rama que choca con main (conflicto real).
mkdir -p /srv/github/dev101x-lab
T=/tmp/equipo && rm -rf $T && git init -q $T && cd $T
printf '# Proyecto del equipo\n\nGuía para colaborar en GitHub.\n' > README.md
git add . && git $EQ commit -q -m "Commit inicial"
mkdir docs && printf '# Guía\n\n1. Haz git pull antes de empezar.\n' > docs/guia.md
git add . && git $EQ commit -q -m "Añade guía de estilo"
git checkout -q -b feature/titulo
sed -i '1s/.*/# Proyecto del equipo Dev101x/' README.md
git $EQ commit -q -am "Cambia el título"
git checkout -q main
sed -i '1s/.*/# Proyecto colaborativo/' README.md
git $EQ commit -q -am "Nuevo título del proyecto"
git clone -q --bare $T /srv/github/dev101x-lab/proyecto-equipo.git
cd / && rm -rf $T
