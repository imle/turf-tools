# Dev-only osmium-tool image. Local OSM extraction shells out here when
# `osmium` is not on the host PATH (see src/dags/osm.py).
FROM debian:trixie-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends osmium-tool \
    && rm -rf /var/lib/apt/lists/*

ENTRYPOINT ["osmium"]
