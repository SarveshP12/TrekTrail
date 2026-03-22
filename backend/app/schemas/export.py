from pydantic import BaseModel


class ExportRequest(BaseModel):
    format: str = "gpx"  # gpx or kml
