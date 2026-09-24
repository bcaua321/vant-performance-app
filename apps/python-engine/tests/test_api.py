"""Testes de integracao do endpoint /analyze."""

import os
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import main  # noqa: E402

client = TestClient(main.app)

VALID_PAYLOAD = {
    "analysisId": "test-analysis",
    "wingspan": 2.4,
    "chord": 0.4,
    "area": 0.96,
    "clMax": 1.8,
    "cd0": 0.035,
    "oswald": 0.8,
    "emptyWeight": 5.0,
    "payload": 3.0,
    "batteryCapacity": 16000,
    "batteryVoltage": 22.2,
    "batteryCells": 6,
    "etaEsc": 0.95,
    "etaMotor": 0.85,
    "etaProp": 0.75,
    "propellerName": "22x10E",
    "propellerDiameter": 22,
    "propellerPitch": 10,
    "propellerDataFile": "22x10E.csv",
    "motorName": "Dualsky ECO4120C 350KV",
    "motorKv": 350,
    "motorMaxPower": 1200,
    "altitude": 0,
}


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_analyze_returns_metrics_and_graphs(tmp_path):
    main.GRAPHS_DIR = str(tmp_path)
    resp = client.post("/analyze", json=VALID_PAYLOAD)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    m = body["metrics"]
    assert m["vStall"] > 0
    assert m["vMax"] > m["vMin"] >= m["vStall"]
    assert m["rcMax"] > 0
    assert m["endurance"] > 0
    assert len(body["graphs"]) == 7
    assert "takeoff_distance" in body["graphs"]
    assert "landing_distance" in body["graphs"]
    for rel in body["graphs"].values():
        assert (tmp_path / rel).exists()


def test_analyze_rejects_invalid_input():
    bad = dict(VALID_PAYLOAD, clMax=10.0)  # fora de [0.5, 3.0]
    resp = client.post("/analyze", json=bad)
    assert resp.status_code == 422


def test_analyze_without_data_file_uses_analytic_model(tmp_path):
    main.GRAPHS_DIR = str(tmp_path)
    payload = dict(VALID_PAYLOAD, analysisId="test-analytic", propellerDataFile=None)
    resp = client.post("/analyze", json=payload)
    assert resp.status_code == 200, resp.text
    assert resp.json()["metrics"]["vStall"] > 0
