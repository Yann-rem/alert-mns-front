# syntax=docker/dockerfile:1

# ===========================================================================
# Étape 1 — construction du client Angular
# ===========================================================================
# Version épinglée à l'identique de `volta` et `engines` dans package.json : la même
# version de Node compile en local, en intégration continue et ici.
FROM node:24.18.0-alpine AS build

WORKDIR /build

# Le verrou de dépendances d'abord : la couche d'installation n'est refaite que si les
# dépendances changent, pas à chaque modification de code.
# Le .npmrc est nécessaire (legacy-peer-deps) : sans lui, `npm ci` échoue.
COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

# `ng build` applique la configuration de production : compilation stricte des gabarits,
# suppression du code mort, et vérification des budgets de taille. Un dépassement de
# budget fait échouer la construction, donc la publication de l'image.
RUN npx ng build

# ===========================================================================
# Étape 2 — service des fichiers et relais vers l'API
# ===========================================================================
FROM nginx:1.27-alpine

# Le constructeur `application` d'Angular place les fichiers destinés au navigateur dans
# un sous-dossier `browser` — le reste de `dist/` ne doit pas être servi.
COPY --from=build /build/dist/alert-mns-front/browser /usr/share/nginx/html

# Un seul serveur pour les fichiers statiques ET le relais de /api et /ws : c'est ce qui
# donne au navigateur une origine unique, et permet donc de conserver l'attribut SameSite
# du cookie de session sans avoir à configurer CORS.
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443
