# Site transition timing

Camera-only correction at source baseline `82252a4`. No terrain, ephemeris or scenario calculations change.

The previous logarithm interpolated full Moon-body radius (roughly 6200→1739 km), allocating almost no time to the last kilometres. The approach now interpolates logarithmic clearance above the destination target's radial distance. Lift uses the source target's radial distance. A zero target or an interrupted pose below that reference falls back to reference zero, preserving a finite monotone path without inventing a surface radius. This curve is display animation, not collision detection against terrain.

Timing is 2200 ms lift, 2600 ms shortest-arc rotation and 5200 ms approach. Overview selections approach directly in 5200 ms; reduced motion remains immediate. Quintic easing preserves stationary phase boundaries. Look targets follow radial travel fraction, preventing a late pitch change while the camera is already near the surface. Public `progress` remains eased phase time for the runtime's orientation transport. Existing API, phase names, generations and cancellation remain intact.

The tradeoff is a ten-second full site flight, with more time to establish geographic context and inspect arrival. For a 1.8 km radial endpoint, the final 10 km receive more than one second. Coarse terrain framing still uses the existing wider endpoint without changing resolution claims.

Validation: 13 focused Node tests pass, and strict targeted TypeScript checking passes. Coverage includes camera and target boundary continuity, exact endpoints, finite clearance, monotone radii, bounded direct-approach angular speed, dateline/antipodal interpolation, coarse framing, immutable snapshots, retargeting and cancellation. Runtime frame pacing, renderer workload and actual browser visual inspection remain separate integration checks; this numerical result does not claim those checks passed.
