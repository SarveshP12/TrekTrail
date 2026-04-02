import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';

export function TrekMap({ routeCoordinates = [], followUser = true, children }: any) {
  // routeCoordinates format is expected to be [longitude, latitude] or [latitude, longitude]
  // react-native-maps expects { latitude, longitude }
  const formattedCoords = routeCoordinates.map((coord: any) => {
    // Check if it's [lat, lon] or {latitude, longitude}
    if (Array.isArray(coord)) {
      return { latitude: coord[0], longitude: coord[1] };
    }
    return coord;
  });

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        showsUserLocation={true}
        followsUserLocation={followUser}
        showsCompass={true}
      >
        {formattedCoords.length > 0 && (
          <Polyline
            coordinates={formattedCoords}
            strokeColor="#10B981" // TrekTrail green
            strokeWidth={4}
          />
        )}
        {children}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', borderRadius: 20 },
  map: { flex: 1 },});
