def test_list_assets_returns_empty_when_db_is_empty(client):
    response = client.get("/api/assets")
    assert response.status_code == 200
    assert response.json() == []


def test_get_nonexistent_asset_returns_404(client):
    response = client.get("/api/assets/9999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Asset not found"


def test_create_asset_requires_authentication(client):
    payload = {"asset_no": "A001", "name": "Test Asset", "quantity": 1}
    response = client.post("/api/assets", json=payload)
    assert response.status_code == 401
