# Slop scan triage

Ran slop-scan0.3.0 scan and lint output. Five findings covered an empty timeline-preference catch, explicit scene/NASA error boundaries, schema rejection and directory fan-out. The empty preference catch now reports unavailable preferences; base64 errors retain their cause. Scene errors already log the cause, dispose and expose2D fallback. Gzip errors preserve cause. Schema validation deliberately returns null; callers show rejection and retain inputs. These paths have regression tests. Directory fan-out does not justify unrelated refactoring. Final scan follows T21–T23.
