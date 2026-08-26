# Student Transport Reference Tools and Repositories

Verified: 2026-08-01. Re-check releases, licenses, advisories, map-data terms and hosted-service policies before adoption.

## GPS tracking: Traccar

- Server: https://github.com/traccar/traccar
- Documentation/API: https://www.traccar.org/documentation/
- License: Apache-2.0.
- Strengths: 200+ GPS protocols, broad device support, REST API, real-time positions, geofences, alarms, notifications and reports.
- Recommendation: deploy as a separate telemetry service and integrate through a SchoolOS adapter. Do not expose Traccar's tenant/user model directly to school users or make it the school transport database.

## Maps: MapLibre

- Web renderer: https://github.com/maplibre/maplibre-gl-js
- Native: https://github.com/maplibre/maplibre-native
- License: BSD-family for referenced renderers; verify exact packages/notices.
- Recommendation: map UI renderer. A renderer does not include a production tile/geocoding service; choose and budget those separately with attribution/usage compliance.

## Routing/map matching: Valhalla

- Repository: https://github.com/valhalla/valhalla
- License: MIT.
- Strengths: OpenStreetMap routing, matrix, isochrones, map matching, time-based/multimodal routing and tour optimization.
- Recommendation: strongest self-hosted routing candidate for ETA, route geometry and map matching. Start behind an adapter or managed provider; do not depend on public demo endpoints in production.

## Routing alternative: OSRM

- Repository: https://github.com/Project-OSRM/osrm-backend
- License: BSD-2-Clause.
- Strengths: high-performance route, table, nearest, match and trip services.
- Recommendation: simpler/faster car-routing alternative; compare Morocco extracts, update operations, matrices and ETA accuracy with Valhalla in a spike.

## Optimization: Google OR-Tools

- Repository: https://github.com/google/or-tools
- License: Apache-2.0.
- Strengths: vehicle-routing, time-window, capacity and assignment optimization.
- Recommendation: optional asynchronous planning assistant after clean operational data exists. Always show constraints/objective and require human acceptance; never silently reassign students.

## Schedule interchange: GTFS

- Reference: https://gtfs.org/documentation/schedule/reference/
- Study: routes, trips, stops, stop times and service calendars.
- Recommendation: align terminology and support future export where useful, but never publish private school/student allocations. School routes may not be public transit.

## Product/domain inspiration

- OpenEduCat: https://github.com/openeducat/openeducat_erp (LGPL-3.0 repository; edition/module availability varies) for school transport navigation and allocations.
- ERPNext: https://github.com/frappe/erpnext (GPL-3.0) for vehicle/assets, maintenance, compliance and auditable document workflows.
- Treat both as inspiration, not embedded application frameworks; conduct legal review before copying code.

## Mapping/data caveats

- OpenStreetMap data is ODbL and requires attribution plus compliance for derived databases.
- Public OSM tile, Nominatim, OSRM or Valhalla demo services are not production backends.
- Document tile/geocoder/routing provider limits, caching, attribution, data residency and outage behavior.

## Best-solution recommendation

Use MapLibre in the SchoolOS UI, Traccar as a separate GPS/device service, and a provider-neutral routing adapter initially backed by Valhalla or a managed API. Add OR-Tools only for transparent operator-approved suggestions. SchoolOS remains authoritative for students, routes, allocations, trip state, rider events, guardians, safety incidents and notification policy.

