from typing import Any
from xml.etree.ElementTree import Element, SubElement, tostring


def generate_gpx(session_name: str, points: list[dict[str, Any]]) -> bytes:
    """Generate a GPX XML file from GPS track points."""
    gpx = Element("gpx", version="1.1", creator="TrekTrack AI")
    gpx.set("xmlns", "http://www.topografix.com/GPX/1/1")

    trk = SubElement(gpx, "trk")
    name = SubElement(trk, "name")
    name.text = session_name

    trkseg = SubElement(trk, "trkseg")
    for pt in points:
        trkpt = SubElement(
            trkseg, "trkpt", lat=str(pt["latitude"]), lon=str(pt["longitude"])
        )
        if pt.get("altitude") is not None:
            ele = SubElement(trkpt, "ele")
            ele.text = str(pt["altitude"])
        time_el = SubElement(trkpt, "time")
        time_el.text = pt["time"].isoformat()

    return b'<?xml version="1.0" encoding="UTF-8"?>\n' + tostring(
        gpx, encoding="unicode"
    ).encode("utf-8")


def generate_kml(session_name: str, points: list[dict[str, Any]]) -> bytes:
    """Generate a KML file from GPS track points."""
    kml = Element("kml")
    kml.set("xmlns", "http://www.opengis.net/kml/2.2")

    doc = SubElement(kml, "Document")
    name = SubElement(doc, "name")
    name.text = session_name

    placemark = SubElement(doc, "Placemark")
    pm_name = SubElement(placemark, "name")
    pm_name.text = session_name

    linestring = SubElement(placemark, "LineString")
    altitude_mode = SubElement(linestring, "altitudeMode")
    altitude_mode.text = "absolute"

    coordinates = SubElement(linestring, "coordinates")
    coord_strings = []
    for pt in points:
        alt = pt.get("altitude") or 0
        coord_strings.append(f"{pt['longitude']},{pt['latitude']},{alt}")
    coordinates.text = " ".join(coord_strings)

    return b'<?xml version="1.0" encoding="UTF-8"?>\n' + tostring(
        kml, encoding="unicode"
    ).encode("utf-8")
