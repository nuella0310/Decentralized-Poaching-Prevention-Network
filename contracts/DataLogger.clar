(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-DRONE u101)
(define-constant ERR-INVALID-DATA u102)
(define-constant ERR-INVALID-GPS u103)
(define-constant ERR-INVALID-HASH u104)
(define-constant ERR-INVALID-DESCRIPTION u105)
(define-constant ERR-INVALID-TIMESTAMP u106)
(define-constant ERR-DRONE-NOT-REGISTERED u107)
(define-constant ERR-OPERATOR-NOT-VERIFIED u108)
(define-constant ERR-SIGHTING-NOT-FOUND u109)
(define-constant ERR-ALREADY-VERIFIED u110)
(define-constant ERR-INVALID-UPDATE u111)
(define-constant ERR-MAX-SIGHTINGS-EXCEEDED u112)
(define-constant ERR-INVALID-STATUS u113)
(define-constant ERR-INVALID-EVIDENCE-TYPE u114)
(define-constant ERR-INVALID-SEVERITY u115)
(define-constant ERR-INVALID-CATEGORY u116)
(define-constant ERR-INVALID-ALTITUDE u117)
(define-constant ERR-INVALID-SPEED u118)
(define-constant ERR-INVALID-BATTERY u119)
(define-constant ERR-INVALID-SIGNAL u120)
(define-constant ERR-INVALID-METADATA u121)
(define-constant ERR-INVALID-VERIFICATION-STATUS u122)
(define-constant ERR-INVALID-ACCESS u123)
(define-constant ERR-INVALID-QUERY u124)
(define-constant ERR-INVALID-PARAM u125)

(define-data-var sighting-counter uint u0)
(define-data-var max-sightings uint u100000)
(define-data-var logging-fee uint u10)
(define-data-var admin-principal principal tx-sender)

(define-map Sightings
  { sighting-id: uint }
  {
    drone-id: principal,
    operator: principal,
    evidence-hash: (buff 32),
    gps-lat: int,
    gps-lon: int,
    altitude: uint,
    speed: uint,
    battery-level: uint,
    signal-strength: uint,
    timestamp: uint,
    description: (string-utf8 256),
    evidence-type: (string-ascii 32),
    severity: uint,
    category: (string-ascii 64),
    verified: bool,
    verification-timestamp: (optional uint),
    metadata: (buff 128),
    status: (string-ascii 32)
  }
)

(define-map DroneOperators
  { drone-id: principal }
  { operator: principal, verified: bool }
)

(define-map SightingUpdates
  { sighting-id: uint }
  {
    updated-description: (string-utf8 256),
    updated-severity: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-sighting (id uint))
  (map-get? Sightings { sighting-id: id })
)

(define-read-only (get-sighting-updates (id uint))
  (map-get? SightingUpdates { sighting-id: id })
)

(define-read-only (is-drone-registered (drone principal))
  (is-some (map-get? DroneOperators { drone-id: drone }))
)

(define-read-only (get-drone-operator (drone principal))
  (map-get? DroneOperators { drone-id: drone })
)

(define-private (validate-drone (drone principal))
  (if (is-some (map-get? DroneOperators { drone-id: drone }))
      (ok true)
      (err ERR-DRONE-NOT-REGISTERED))
)

(define-private (validate-operator (op principal) (drone principal))
  (match (map-get? DroneOperators { drone-id: drone })
    info
      (if (and (is-eq (get operator info) op) (get verified info))
          (ok true)
          (err ERR-OPERATOR-NOT-VERIFIED))
    (err ERR-DRONE-NOT-REGISTERED))
)

(define-private (validate-evidence-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR-INVALID-HASH))
)

(define-private (validate-gps (lat int) (lon int))
  (if (and (>= lat -90000000) (<= lat 90000000) (>= lon -180000000) (<= lon 180000000))
      (ok true)
      (err ERR-INVALID-GPS))
)

(define-private (validate-description (desc (string-utf8 256)))
  (if (<= (len desc) u256)
      (ok true)
      (err ERR-INVALID-DESCRIPTION))
)

(define-private (validate-timestamp (ts uint))
  (if (<= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-evidence-type (typ (string-ascii 32)))
  (if (or (is-eq typ "image") (is-eq typ "video") (is-eq typ "audio"))
      (ok true)
      (err ERR-INVALID-EVIDENCE-TYPE))
)

(define-private (validate-severity (sev uint))
  (if (<= sev u10)
      (ok true)
      (err ERR-INVALID-SEVERITY))
)

(define-private (validate-category (cat (string-ascii 64)))
  (if (or (is-eq cat "poaching") (is-eq cat "trespassing") (is-eq cat "illegal-hunting"))
      (ok true)
      (err ERR-INVALID-CATEGORY))
)

(define-private (validate-altitude (alt uint))
  (if (<= alt u10000)
      (ok true)
      (err ERR-INVALID-ALTITUDE))
)

(define-private (validate-speed (spd uint))
  (if (<= spd u100)
      (ok true)
      (err ERR-INVALID-SPEED))
)

(define-private (validate-battery (bat uint))
  (if (<= bat u100)
      (ok true)
      (err ERR-INVALID-BATTERY))
)

(define-private (validate-signal (sig uint))
  (if (<= sig u100)
      (ok true)
      (err ERR-INVALID-SIGNAL))
)

(define-private (validate-metadata (meta (buff 128)))
  (if (<= (len meta) u128)
      (ok true)
      (err ERR-INVALID-METADATA))
)

(define-private (validate-status (stat (string-ascii 32)))
  (if (or (is-eq stat "pending") (is-eq stat "verified") (is-eq stat "rejected"))
      (ok true)
      (err ERR-INVALID-STATUS))
)

(define-public (register-drone (drone principal) (op principal))
  (begin
    (asserts! (is-eq tx-sender admin-principal) (err ERR-NOT-AUTHORIZED))
    (map-set DroneOperators { drone-id: drone } { operator: op, verified: true })
    (ok true)
  )
)

(define-public (set-logging-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender admin-principal) (err ERR-NOT-AUTHORIZED))
    (var-set logging-fee new-fee)
    (ok true)
  )
)

(define-public (set-max-sightings (new-max uint))
  (begin
    (asserts! (is-eq tx-sender admin-principal) (err ERR-NOT-AUTHORIZED))
    (var-set max-sightings new-max)
    (ok true)
  )
)

(define-public (log-sighting
  (drone principal)
  (evidence-hash (buff 32))
  (gps-lat int)
  (gps-lon int)
  (altitude uint)
  (speed uint)
  (battery-level uint)
  (signal-strength uint)
  (description (string-utf8 256))
  (evidence-type (string-ascii 32))
  (severity uint)
  (category (string-ascii 64))
  (metadata (buff 128))
  )
  (let (
    (next-id (var-get sighting-counter))
    (current-max (var-get max-sightings))
    (op tx-sender)
    (ts block-height)
  )
    (asserts! (< next-id current-max) (err ERR-MAX-SIGHTINGS-EXCEEDED))
    (try! (validate-drone drone))
    (try! (validate-operator op drone))
    (try! (validate-evidence-hash evidence-hash))
    (try! (validate-gps gps-lat gps-lon))
    (try! (validate-altitude altitude))
    (try! (validate-speed speed))
    (try! (validate-battery battery-level))
    (try! (validate-signal signal-strength))
    (try! (validate-description description))
    (try! (validate-evidence-type evidence-type))
    (try! (validate-severity severity))
    (try! (validate-category category))
    (try! (validate-metadata metadata))
    (try! (validate-timestamp ts))
    (try! (stx-transfer? (var-get logging-fee) tx-sender admin-principal))
    (map-set Sightings { sighting-id: next-id }
      {
        drone-id: drone,
        operator: op,
        evidence-hash: evidence-hash,
        gps-lat: gps-lat,
        gps-lon: gps-lon,
        altitude: altitude,
        speed: speed,
        battery-level: battery-level,
        signal-strength: signal-strength,
        timestamp: ts,
        description: description,
        evidence-type: evidence-type,
        severity: severity,
        category: category,
        verified: false,
        verification-timestamp: none,
        metadata: metadata,
        status: "pending"
      }
    )
    (var-set sighting-counter (+ next-id u1))
    (print { event: "sighting-logged", id: next-id })
    (ok next-id)
  )
)

(define-public (update-sighting
  (id uint)
  (new-description (string-utf8 256))
  (new-severity uint)
  )
  (let ((sighting (map-get? Sightings { sighting-id: id })))
    (match sighting
      s
        (begin
          (asserts! (is-eq (get operator s) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (not (get verified s)) (err ERR-ALREADY-VERIFIED))
          (try! (validate-description new-description))
          (try! (validate-severity new-severity))
          (map-set Sightings { sighting-id: id }
            (merge s {
              description: new-description,
              severity: new-severity,
              timestamp: block-height
            })
          )
          (map-set SightingUpdates { sighting-id: id }
            {
              updated-description: new-description,
              updated-severity: new-severity,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "sighting-updated", id: id })
          (ok true)
        )
      (err ERR-SIGHTING-NOT-FOUND)
    )
  )
)

(define-public (verify-sighting (id uint))
  (let ((sighting (map-get? Sightings { sighting-id: id })))
    (match sighting
      s
        (begin
          (asserts! (is-eq tx-sender admin-principal) (err ERR-NOT-AUTHORIZED))
          (asserts! (not (get verified s)) (err ERR-ALREADY-VERIFIED))
          (map-set Sightings { sighting-id: id }
            (merge s {
              verified: true,
              verification-timestamp: (some block-height),
              status: "verified"
            })
          )
          (print { event: "sighting-verified", id: id })
          (ok true)
        )
      (err ERR-SIGHTING-NOT-FOUND)
    )
  )
)

(define-public (reject-sighting (id uint))
  (let ((sighting (map-get? Sightings { sighting-id: id })))
    (match sighting
      s
        (begin
          (asserts! (is-eq tx-sender admin-principal) (err ERR-NOT-AUTHORIZED))
          (asserts! (not (get verified s)) (err ERR-ALREADY-VERIFIED))
          (map-set Sightings { sighting-id: id }
            (merge s {
              verified: false,
              verification-timestamp: (some block-height),
              status: "rejected"
            })
          )
          (print { event: "sighting-rejected", id: id })
          (ok true)
        )
      (err ERR-SIGHTING-NOT-FOUND)
    )
  )
)

(define-public (get-sighting-count)
  (ok (var-get sighting-counter))
)

(define-public (check-drone-status (drone principal))
  (ok (is-drone-registered drone))
)