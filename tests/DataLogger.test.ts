import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV, asciiCV, intCV, buffCV, optionalCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_DRONE = 101;
const ERR_INVALID_DATA = 102;
const ERR_INVALID_GPS = 103;
const ERR_INVALID_HASH = 104;
const ERR_INVALID_DESCRIPTION = 105;
const ERR_INVALID_TIMESTAMP = 106;
const ERR_DRONE_NOT_REGISTERED = 107;
const ERR_OPERATOR_NOT_VERIFIED = 108;
const ERR_SIGHTING_NOT_FOUND = 109;
const ERR_ALREADY_VERIFIED = 110;
const ERR_MAX_SIGHTINGS_EXCEEDED = 112;
const ERR_INVALID_EVIDENCE_TYPE = 114;
const ERR_INVALID_SEVERITY = 115;
const ERR_INVALID_CATEGORY = 116;
const ERR_INVALID_ALTITUDE = 117;
const ERR_INVALID_SPEED = 118;
const ERR_INVALID_BATTERY = 119;
const ERR_INVALID_SIGNAL = 120;
const ERR_INVALID_METADATA = 121;
const ERR_INVALID_STATUS = 113;

interface Sighting {
  droneId: string;
  operator: string;
  evidenceHash: Uint8Array;
  gpsLat: number;
  gpsLon: number;
  altitude: number;
  speed: number;
  batteryLevel: number;
  signalStrength: number;
  timestamp: number;
  description: string;
  evidenceType: string;
  severity: number;
  category: string;
  verified: boolean;
  verificationTimestamp: number | null;
  metadata: Uint8Array;
  status: string;
}

interface SightingUpdate {
  updatedDescription: string;
  updatedSeverity: number;
  updateTimestamp: number;
  updater: string;
}

interface DroneOperator {
  operator: string;
  verified: boolean;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class DataLoggerMock {
  state: {
    sightingCounter: number;
    maxSightings: number;
    loggingFee: number;
    adminPrincipal: string;
    sightings: Map<number, Sighting>;
    sightingUpdates: Map<number, SightingUpdate>;
    droneOperators: Map<string, DroneOperator>;
  } = {
    sightingCounter: 0,
    maxSightings: 100000,
    loggingFee: 10,
    adminPrincipal: "ST1ADMIN",
    sightings: new Map(),
    sightingUpdates: new Map(),
    droneOperators: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      sightingCounter: 0,
      maxSightings: 100000,
      loggingFee: 10,
      adminPrincipal: "ST1ADMIN",
      sightings: new Map(),
      sightingUpdates: new Map(),
      droneOperators: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
  }

  registerDrone(drone: string, op: string): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.droneOperators.set(drone, { operator: op, verified: true });
    return { ok: true, value: true };
  }

  setLoggingFee(newFee: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.loggingFee = newFee;
    return { ok: true, value: true };
  }

  logSighting(
    drone: string,
    evidenceHash: Uint8Array,
    gpsLat: number,
    gpsLon: number,
    altitude: number,
    speed: number,
    batteryLevel: number,
    signalStrength: number,
    description: string,
    evidenceType: string,
    severity: number,
    category: string,
    metadata: Uint8Array
  ): Result<number> {
    if (this.state.sightingCounter >= this.state.maxSightings) return { ok: false, value: ERR_MAX_SIGHTINGS_EXCEEDED };
    if (!this.state.droneOperators.has(drone)) return { ok: false, value: ERR_DRONE_NOT_REGISTERED };
    const opInfo = this.state.droneOperators.get(drone)!;
    if (opInfo.operator !== this.caller || !opInfo.verified) return { ok: false, value: ERR_OPERATOR_NOT_VERIFIED };
    if (evidenceHash.length !== 32) return { ok: false, value: ERR_INVALID_HASH };
    if (gpsLat < -90000000 || gpsLat > 90000000 || gpsLon < -180000000 || gpsLon > 180000000) return { ok: false, value: ERR_INVALID_GPS };
    if (altitude > 10000) return { ok: false, value: ERR_INVALID_ALTITUDE };
    if (speed > 100) return { ok: false, value: ERR_INVALID_SPEED };
    if (batteryLevel > 100) return { ok: false, value: ERR_INVALID_BATTERY };
    if (signalStrength > 100) return { ok: false, value: ERR_INVALID_SIGNAL };
    if (description.length > 256) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (!["image", "video", "audio"].includes(evidenceType)) return { ok: false, value: ERR_INVALID_EVIDENCE_TYPE };
    if (severity > 10) return { ok: false, value: ERR_INVALID_SEVERITY };
    if (!["poaching", "trespassing", "illegal-hunting"].includes(category)) return { ok: false, value: ERR_INVALID_CATEGORY };
    if (metadata.length > 128) return { ok: false, value: ERR_INVALID_METADATA };
    if (this.blockHeight < 0) return { ok: false, value: ERR_INVALID_TIMESTAMP };

    this.stxTransfers.push({ amount: this.state.loggingFee, from: this.caller, to: this.state.adminPrincipal });

    const id = this.state.sightingCounter;
    const sighting: Sighting = {
      droneId: drone,
      operator: this.caller,
      evidenceHash,
      gpsLat,
      gpsLon,
      altitude,
      speed,
      batteryLevel,
      signalStrength,
      timestamp: this.blockHeight,
      description,
      evidenceType,
      severity,
      category,
      verified: false,
      verificationTimestamp: null,
      metadata,
      status: "pending",
    };
    this.state.sightings.set(id, sighting);
    this.state.sightingCounter++;
    return { ok: true, value: id };
  }

  getSighting(id: number): Sighting | null {
    return this.state.sightings.get(id) || null;
  }

  updateSighting(id: number, newDescription: string, newSeverity: number): Result<boolean> {
    const sighting = this.state.sightings.get(id);
    if (!sighting) return { ok: false, value: ERR_SIGHTING_NOT_FOUND };
    if (sighting.operator !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (sighting.verified) return { ok: false, value: ERR_ALREADY_VERIFIED };
    if (newDescription.length > 256) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (newSeverity > 10) return { ok: false, value: ERR_INVALID_SEVERITY };

    const updated: Sighting = {
      ...sighting,
      description: newDescription,
      severity: newSeverity,
      timestamp: this.blockHeight,
    };
    this.state.sightings.set(id, updated);
    this.state.sightingUpdates.set(id, {
      updatedDescription: newDescription,
      updatedSeverity: newSeverity,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  verifySighting(id: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const sighting = this.state.sightings.get(id);
    if (!sighting) return { ok: false, value: ERR_SIGHTING_NOT_FOUND };
    if (sighting.verified) return { ok: false, value: ERR_ALREADY_VERIFIED };

    const updated: Sighting = {
      ...sighting,
      verified: true,
      verificationTimestamp: this.blockHeight,
      status: "verified",
    };
    this.state.sightings.set(id, updated);
    return { ok: true, value: true };
  }

  rejectSighting(id: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const sighting = this.state.sightings.get(id);
    if (!sighting) return { ok: false, value: ERR_SIGHTING_NOT_FOUND };
    if (sighting.verified) return { ok: false, value: ERR_ALREADY_VERIFIED };

    const updated: Sighting = {
      ...sighting,
      verified: false,
      verificationTimestamp: this.blockHeight,
      status: "rejected",
    };
    this.state.sightings.set(id, updated);
    return { ok: true, value: true };
  }

  getSightingCount(): Result<number> {
    return { ok: true, value: this.state.sightingCounter };
  }

  checkDroneStatus(drone: string): Result<boolean> {
    return { ok: true, value: this.state.droneOperators.has(drone) };
  }
}

describe("DataLogger", () => {
  let contract: DataLoggerMock;

  beforeEach(() => {
    contract = new DataLoggerMock();
    contract.reset();
  });

  it("registers a drone successfully", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.registerDrone("DRONE1", "ST1TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.droneOperators.get("DRONE1")).toEqual({ operator: "ST1TEST", verified: true });
  });

  it("rejects drone registration by non-admin", () => {
    const result = contract.registerDrone("DRONE1", "ST1TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("logs a sighting successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.registerDrone("DRONE1", "ST1TEST");
    contract.caller = "ST1TEST";
    const evidenceHash = new Uint8Array(32).fill(1);
    const metadata = new Uint8Array(128).fill(2);
    const result = contract.logSighting(
      "DRONE1",
      evidenceHash,
      40000000,
      -75000000,
      500,
      20,
      80,
      90,
      "Suspicious activity",
      "image",
      5,
      "poaching",
      metadata
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const sighting = contract.getSighting(0);
    expect(sighting?.droneId).toBe("DRONE1");
    expect(sighting?.operator).toBe("ST1TEST");
    expect(sighting?.gpsLat).toBe(40000000);
    expect(sighting?.severity).toBe(5);
    expect(sighting?.verified).toBe(false);
    expect(contract.stxTransfers).toEqual([{ amount: 10, from: "ST1TEST", to: "ST1ADMIN" }]);
  });

  it("rejects sighting log without registered drone", () => {
    const evidenceHash = new Uint8Array(32).fill(1);
    const metadata = new Uint8Array(128).fill(2);
    const result = contract.logSighting(
      "DRONE1",
      evidenceHash,
      40000000,
      -75000000,
      500,
      20,
      80,
      90,
      "Suspicious activity",
      "image",
      5,
      "poaching",
      metadata
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_DRONE_NOT_REGISTERED);
  });

  it("rejects sighting log with invalid operator", () => {
    contract.caller = "ST1ADMIN";
    contract.registerDrone("DRONE1", "ST2OTHER");
    contract.caller = "ST1TEST";
    const evidenceHash = new Uint8Array(32).fill(1);
    const metadata = new Uint8Array(128).fill(2);
    const result = contract.logSighting(
      "DRONE1",
      evidenceHash,
      40000000,
      -75000000,
      500,
      20,
      80,
      90,
      "Suspicious activity",
      "image",
      5,
      "poaching",
      metadata
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_OPERATOR_NOT_VERIFIED);
  });

  it("rejects sighting log with invalid hash", () => {
    contract.caller = "ST1ADMIN";
    contract.registerDrone("DRONE1", "ST1TEST");
    contract.caller = "ST1TEST";
    const evidenceHash = new Uint8Array(31).fill(1);
    const metadata = new Uint8Array(128).fill(2);
    const result = contract.logSighting(
      "DRONE1",
      evidenceHash,
      40000000,
      -75000000,
      500,
      20,
      80,
      90,
      "Suspicious activity",
      "image",
      5,
      "poaching",
      metadata
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_HASH);
  });

  it("updates a sighting successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.registerDrone("DRONE1", "ST1TEST");
    contract.caller = "ST1TEST";
    const evidenceHash = new Uint8Array(32).fill(1);
    const metadata = new Uint8Array(128).fill(2);
    contract.logSighting(
      "DRONE1",
      evidenceHash,
      40000000,
      -75000000,
      500,
      20,
      80,
      90,
      "Old description",
      "image",
      5,
      "poaching",
      metadata
    );
    const result = contract.updateSighting(0, "New description", 7);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const sighting = contract.getSighting(0);
    expect(sighting?.description).toBe("New description");
    expect(sighting?.severity).toBe(7);
    const update = contract.state.sightingUpdates.get(0);
    expect(update?.updatedDescription).toBe("New description");
    expect(update?.updatedSeverity).toBe(7);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent sighting", () => {
    const result = contract.updateSighting(99, "New description", 7);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_SIGHTING_NOT_FOUND);
  });

  it("rejects update by non-operator", () => {
    contract.caller = "ST1ADMIN";
    contract.registerDrone("DRONE1", "ST1TEST");
    contract.caller = "ST1TEST";
    const evidenceHash = new Uint8Array(32).fill(1);
    const metadata = new Uint8Array(128).fill(2);
    contract.logSighting(
      "DRONE1",
      evidenceHash,
      40000000,
      -75000000,
      500,
      20,
      80,
      90,
      "Old description",
      "image",
      5,
      "poaching",
      metadata
    );
    contract.caller = "ST2OTHER";
    const result = contract.updateSighting(0, "New description", 7);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects update for verified sighting", () => {
    contract.caller = "ST1ADMIN";
    contract.registerDrone("DRONE1", "ST1TEST");
    contract.caller = "ST1TEST";
    const evidenceHash = new Uint8Array(32).fill(1);
    const metadata = new Uint8Array(128).fill(2);
    contract.logSighting(
      "DRONE1",
      evidenceHash,
      40000000,
      -75000000,
      500,
      20,
      80,
      90,
      "Old description",
      "image",
      5,
      "poaching",
      metadata
    );
    contract.caller = "ST1ADMIN";
    contract.verifySighting(0);
    contract.caller = "ST1TEST";
    const result = contract.updateSighting(0, "New description", 7);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ALREADY_VERIFIED);
  });

  it("verifies a sighting successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.registerDrone("DRONE1", "ST1TEST");
    contract.caller = "ST1TEST";
    const evidenceHash = new Uint8Array(32).fill(1);
    const metadata = new Uint8Array(128).fill(2);
    contract.logSighting(
      "DRONE1",
      evidenceHash,
      40000000,
      -75000000,
      500,
      20,
      80,
      90,
      "Suspicious activity",
      "image",
      5,
      "poaching",
      metadata
    );
    contract.caller = "ST1ADMIN";
    const result = contract.verifySighting(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const sighting = contract.getSighting(0);
    expect(sighting?.verified).toBe(true);
    expect(sighting?.status).toBe("verified");
  });

  it("rejects verification by non-admin", () => {
    contract.caller = "ST1ADMIN";
    contract.registerDrone("DRONE1", "ST1TEST");
    contract.caller = "ST1TEST";
    const evidenceHash = new Uint8Array(32).fill(1);
    const metadata = new Uint8Array(128).fill(2);
    contract.logSighting(
      "DRONE1",
      evidenceHash,
      40000000,
      -75000000,
      500,
      20,
      80,
      90,
      "Suspicious activity",
      "image",
      5,
      "poaching",
      metadata
    );
    const result = contract.verifySighting(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects a sighting successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.registerDrone("DRONE1", "ST1TEST");
    contract.caller = "ST1TEST";
    const evidenceHash = new Uint8Array(32).fill(1);
    const metadata = new Uint8Array(128).fill(2);
    contract.logSighting(
      "DRONE1",
      evidenceHash,
      40000000,
      -75000000,
      500,
      20,
      80,
      90,
      "Suspicious activity",
      "image",
      5,
      "poaching",
      metadata
    );
    contract.caller = "ST1ADMIN";
    const result = contract.rejectSighting(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const sighting = contract.getSighting(0);
    expect(sighting?.verified).toBe(false);
    expect(sighting?.status).toBe("rejected");
  });

  it("returns correct sighting count", () => {
    contract.caller = "ST1ADMIN";
    contract.registerDrone("DRONE1", "ST1TEST");
    contract.caller = "ST1TEST";
    const evidenceHash = new Uint8Array(32).fill(1);
    const metadata = new Uint8Array(128).fill(2);
    contract.logSighting(
      "DRONE1",
      evidenceHash,
      40000000,
      -75000000,
      500,
      20,
      80,
      90,
      "Suspicious activity",
      "image",
      5,
      "poaching",
      metadata
    );
    contract.logSighting(
      "DRONE1",
      evidenceHash,
      41000000,
      -76000000,
      600,
      25,
      85,
      95,
      "Another activity",
      "video",
      6,
      "trespassing",
      metadata
    );
    const result = contract.getSightingCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks drone status correctly", () => {
    contract.caller = "ST1ADMIN";
    contract.registerDrone("DRONE1", "ST1TEST");
    const result = contract.checkDroneStatus("DRONE1");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkDroneStatus("DRONE2");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("sets logging fee successfully", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.setLoggingFee(20);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.loggingFee).toBe(20);
    contract.registerDrone("DRONE1", "ST1TEST");
    contract.caller = "ST1TEST";
    const evidenceHash = new Uint8Array(32).fill(1);
    const metadata = new Uint8Array(128).fill(2);
    contract.logSighting(
      "DRONE1",
      evidenceHash,
      40000000,
      -75000000,
      500,
      20,
      80,
      90,
      "Suspicious activity",
      "image",
      5,
      "poaching",
      metadata
    );
    expect(contract.stxTransfers).toEqual([{ amount: 20, from: "ST1TEST", to: "ST1ADMIN" }]);
  });

  it("rejects sighting log when max exceeded", () => {
    contract.state.maxSightings = 1;
    contract.caller = "ST1ADMIN";
    contract.registerDrone("DRONE1", "ST1TEST");
    contract.caller = "ST1TEST";
    const evidenceHash = new Uint8Array(32).fill(1);
    const metadata = new Uint8Array(128).fill(2);
    contract.logSighting(
      "DRONE1",
      evidenceHash,
      40000000,
      -75000000,
      500,
      20,
      80,
      90,
      "Suspicious activity",
      "image",
      5,
      "poaching",
      metadata
    );
    const result = contract.logSighting(
      "DRONE1",
      evidenceHash,
      41000000,
      -76000000,
      600,
      25,
      85,
      95,
      "Another activity",
      "video",
      6,
      "trespassing",
      metadata
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_SIGHTINGS_EXCEEDED);
  });
});