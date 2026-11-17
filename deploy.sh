#!/bin/bash
set -e
# Build and publish to /coke-africa/. Pull whatever revision you want deployed
# before running this — the script deliberately does not touch git.
echo "Building..."
npm run build
echo "Deploying build files..."
mkdir -p /var/www/html/coke-africa/build
cp -r dist/* /var/www/html/coke-africa/build
echo "Deployment completed successfully."
