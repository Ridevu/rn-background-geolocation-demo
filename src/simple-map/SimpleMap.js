import React, { Component } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  AsyncStorage,
  TouchableHighlight
} from 'react-native';

// For dispatching back to HomeScreen
import App from '../App';

// For posting to tracker.transistorsoft.com
import DeviceInfo from 'react-native-device-info';

import { NavigationActions, StackActions } from 'react-navigation';

// Import native-base UI components
import { 
  Container,
  Button, Icon,
  Text,
  Header, Footer, Title, FooterTab,
  Content, 
  Left, Body, Right,
  Switch 
} from 'native-base';

// react-native-maps
import MapView, {Polyline} from 'react-native-maps';

import BackgroundGeolocation from '../react-native-background-geolocation';

const LATITUDE_DELTA = 0.00922;
const LONGITUDE_DELTA = 0.00421;

const TRACKER_HOST = 'http://tracker.transistorsoft.com/locations/';

const MMP_URL_SET_JOB_STATUS = 'https://managemyapi.azurewebsites.net/Mobile.asmx/SetJobStatus';
const MMP_URL_UPLOAD_TRACK_POINTS = 'https://managemyapi.azurewebsites.net/Mobile.asmx/UploadTrackpoints';
const MMP_URL_UPLOAD_TRACK_POINTS_PROXY = 'https://ln2w5ozvo2.execute-api.ap-southeast-2.amazonaws.com/proxyPostAPI/';
const COORDINATES_BUFFER_LENGTH = 2  ;

export default class SimpleMap extends Component<{}> {
  constructor(props) {
    super(props);

    this.state = {
      enabled: false,
      paused: false,
      isMoving: false,
      motionActivity: {activity: 'unknown', confidence: 100},
      odometer: 0,
      username: props.navigation.state.params.username,
      // MapView
      markers: [],
      coordinates: [],
      unreportedCoordinates: [],
      showsUserLocation: true,
      statusMessage: 'Waiting to start tracking',
      isFollowingUser: true
    };
    AsyncStorage.setItem("@mmp:next_page", 'SimpleMap');
}

  componentDidMount() {
    // Step 1:  Listen to events:
    BackgroundGeolocation.on('location', this.onLocation.bind(this));
    BackgroundGeolocation.on('motionchange', this.onMotionChange.bind(this));
    BackgroundGeolocation.on('activitychange', this.onActivityChange.bind(this));
    BackgroundGeolocation.on('providerchange', this.onProviderChange.bind(this));
    BackgroundGeolocation.on('powersavechange', this.onPowerSaveChange.bind(this));

    // Step 2:  #configure:
    BackgroundGeolocation.configure({
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      notificationPriority: BackgroundGeolocation.NOTIFICATION_PRIORITY_DEFAULT,
      distanceFilter: 0,
      locationUpdateInterval: 3000,
      fastestLocationUpdateInterval: 3000,
      notificationText: "",
      allowIdenticalLocations: true,
      url: TRACKER_HOST + this.state.username,
      params: {
        // Required for tracker.transistorsoft.com
        device: {
          uuid: DeviceInfo.getUniqueID(),
          model: DeviceInfo.getModel(),
          platform: DeviceInfo.getSystemName(),
          manufacturer: DeviceInfo.getManufacturer(),
          version: DeviceInfo.getSystemVersion(),
          framework: 'ReactNative'
        }
      },
      autoSync: true,
      autoSyncThreshold: 12,
      stopTimeout: 30,

      stopOnTerminate: false,
      startOnBoot: true,
      foregroundService: true,
      preventSuspend: true,
      heartbeatInterval: 60,
      forceReloadOnHeartbeat: true,
      minimumActivityRecognitionConfidence: 50,

      debug: true,
      logLevel: BackgroundGeolocation.LOG_LEVEL_WARNING,
    }, (state) => {
      this.setState({
        enabled: state.enabled,
        isMoving: state.isMoving,
        showsUserLocation: state.enabled,
        paused: state.paused
      });
    });

    AsyncStorage.getItem('@mmp:enabled', (err, item) => { 
      this.setState({enabled: (item == 'true')});
      if(this.state.enabled && !this.state.paused && !this.state.componentStarted)
        this.onStartTracking(null);
    });

    AsyncStorage.getItem('@mmp:paused', (err, item) => { 
      this.setState({paused: (item == 'true')});
      if(this.state.enabled && !this.state.paused && !this.state.componentStarted)
        this.onStartTracking(null);
    });

    AsyncStorage.getItem('@mmp:locations', (err, item) => this.loadLocationsFromStorage(item));

    AsyncStorage.getItem('@mmp:auth_token', (err, item) => { 
      this.setState({auth_token: item});
      BackgroundGeolocation.configure({

        desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
        notificationPriority: BackgroundGeolocation.NOTIFICATION_PRIORITY_DEFAULT,
        distanceFilter: 0,
        locationUpdateInterval: 3000,
        fastestLocationUpdateInterval: 3000,
        notificationText: "",
        allowIdenticalLocations: true,
        autoSync: true,
        autoSyncThreshold: 12,          

        stopOnTerminate: false,
        startOnBoot: true,
        foregroundService: true,
        preventSuspend: true,
        heartbeatInterval: 60,
        forceReloadOnHeartbeat: true,
        minimumActivityRecognitionConfidence: 50,
        debug: true,
        logLevel: BackgroundGeolocation.LOG_LEVEL_WARNING,

        url: MMP_URL_UPLOAD_TRACK_POINTS_PROXY,
        locationTemplate: '{ "timestamp":"<%= timestamp %>", "latitude":"<%= latitude %>", "longitude":"<%= longitude %>" }',
        params: { extras: { "token": item }}
      });
    });

    this.onGoToLocation();
  }

  /**
  * @event location
  */
  onLocation(location) {
    console.log('[event] location: ', location);

    if (!location.sample) {
      this.addMarker(location);
      this.setState({
        odometer: (location.odometer/1000).toFixed(1)
      });
    }
    if(this.state.isFollowingUser)
      this.setCenter(location);
  }
  /**
  * @event motionchange
  */
  onMotionChange(event) {
    console.log('[event] motionchange: ', event.isMovign, event.location);
    this.setState({
      isMoving: event.isMoving
    });
    let location = event.location;    
  }
  /**
  * @event activitychange
  */
  onActivityChange(event) {
    console.log('[event] activitychange: ', event);
    this.setState({
      motionActivity: event
    });
  }
  /**
  * @event providerchange
  */
  onProviderChange(event) {
    console.log('[event] providerchange', event);
  }
  /**
  * @event powersavechange
  */
  onPowerSaveChange(isPowerSaveMode) {
    console.log('[event] powersavechange', isPowerSaveMode);
  }

  onGoToLocation() {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        let curr_latitude = position.coords.latitude;
        let curr_longitude = position.coords.longitude;
        console.log("CURRENT LOCATION OBTAINED - " + curr_longitude.toString());
        var curr_location = {lat: curr_latitude, lng: curr_longitude};

        this.refs.map.animateToRegion({
          latitude: curr_latitude,
          longitude: curr_longitude,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA
        });
        this.setState({isFollowingUser:true});
      }
    );    
  }

  onStartTracking(value) {
    this.setState({
      enabled: true,
      paused: false,
      statusMessage: 'Now tracking...',
      isMoving: false,
      showsUserLocation: false,
      componentStarted: true
    });

    AsyncStorage.setItem("@mmp:enabled", 'true');
    AsyncStorage.setItem("@mmp:paused", 'false');

    BackgroundGeolocation.start((state) => {
      this.setState({
        showsUserLocation: true
      });
      let isMoving = true;
      this.setState({isMoving: isMoving});
      BackgroundGeolocation.changePace(isMoving);          
      this.startAnonymousTrack();
    });
  }

  onPauseTracking(value) {
    this.setState({
      enabled: false,
      paused: true,
      statusMessage: 'Tracking paused, but track still open',
      isMoving: false,
      showsUserLocation: false,
    });

    AsyncStorage.setItem("@mmp:enabled", 'false');
    AsyncStorage.setItem("@mmp:paused", 'true');    

    BackgroundGeolocation.stop();
    console.log('Pausing the track - we may continue later...');
  }

  onStopTracking(value) {
    this.setState({
      enabled: false,
      paused: false,
      statusMessage: 'Sending last location points to server',
      isMoving: false,
      showsUserLocation: false,
    });

    AsyncStorage.setItem("@mmp:enabled", 'false');
    AsyncStorage.setItem("@mmp:paused", 'false');
    
    BackgroundGeolocation.stop();
    console.log('Closing the track - sending remaining points to server...');
    this.closeAnonymousTrack();
    this.setState({
      statusMessage: 'Track uploaded and closed',
      isMoving: false,
      showsUserLocation: false,
    });

    BackgroundGeolocation.destroyLocations(function() {
      console.log('- cleared database'); 
    });
  }
  
  onResetMarkers() {
    this.setState({
      coordinates: [],
      markers: []
    });
    AsyncStorage.setItem("@mmp:locations", '{"locations": []}');
  }

  padDateTimeElements(input)
  {
      return ('0' + input.toString()).slice(-2);
  }
    
  stringifyTime(timeInput)
  {
    let timeString =	timeInput.getUTCFullYear().toString() + '-' +
    this.padDateTimeElements(timeInput.getUTCMonth()+1) + '-' +
    this.padDateTimeElements(timeInput.getUTCDate()) + ' ' +
    this.padDateTimeElements(timeInput.getUTCHours()) + ':' +
    this.padDateTimeElements(timeInput.getUTCMinutes()) + ':' +
    this.padDateTimeElements(timeInput.getUTCSeconds());
    return timeString;
  }

  addMarker(location) {
    let marker = {
      key: location.uuid,
      title: location.timestamp,
      heading: location.coords.heading,
      coordinate: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      }
    };

    this.setState({
      coordinates: [...this.state.coordinates, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      }],
      unreportedCoordinates: [...this.state.unreportedCoordinates, {
        "datetime": this.stringifyTime(new Date()),
        lat: location.coords.latitude,
        lon: location.coords.longitude
      }]
    });

    if (this.state.unreportedCoordinates.length == 1 || this.state.unreportedCoordinates.length > COORDINATES_BUFFER_LENGTH)
    {
      this.saveLocationsToStorage();
    }
  }

  saveLocationsToStorage() {
    let locationsJson = JSON.stringify({
      locations: this.state.coordinates
    });
    AsyncStorage.setItem("@mmp:locations", locationsJson);
  }

  loadLocationsFromStorage(locationsJson) {
    console.log("Loading locations from storage!!!")
    if(locationsJson) {
      let locations = JSON.parse(locationsJson).locations;    
      if(locations)
        this.setState({ coordinates: locations });
    }
    else
      this.setState({ coordinates: [] });
  }

  setCenter(location) {
    if (!this.refs.map) { return; }

    this.refs.map.animateToRegion({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: LATITUDE_DELTA,
      longitudeDelta: LONGITUDE_DELTA
    });
  }

  renderMarkers() {
    let rs = [];
    this.state.markers.map((marker) => {
      rs.push((
        <MapView.Marker
          key={marker.key}
          coordinate={marker.coordinate}
          anchor={{x:0, y:0.1}}
          title={marker.title}>
          <View style={[styles.markerIcon]}></View>
        </MapView.Marker>
      ));
    });
    return rs;
  }

  async startAnonymousTrack() {
    var auth_token = "";
    await AsyncStorage.getItem('@mmp:auth_token', (err, item) => auth_token = item);
    body = JSON.stringify({
      token: auth_token,
      job_id: 0,
      job_new_status: 1
    });
    fetch(MMP_URL_SET_JOB_STATUS, {
        method: 'POST',
        headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8;',
        'Data-Type': 'json'
        },
        body: body,
    })
    .then((response) => {
        console.log("Started an anonymous track");
    })
    .catch((error) =>{
        console.error(error);
    });
  }

  async closeAnonymousTrack() {
    var auth_token = "";
    await AsyncStorage.getItem('@mmp:auth_token', (err, item) => auth_token = item);
    body = JSON.stringify({
      token: auth_token,
      job_id: 0,
      job_new_status: 3
    });
    fetch(MMP_URL_SET_JOB_STATUS, {
      method: 'POST',
      headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json; charset=utf-8;',
          'Data-Type': 'json'
      },
      body: body,
      })
      .then((response) => {
            console.log("Closed the anonymous track");
      })
      .catch((error) =>{
            console.error(error);
      }
    );
  }

  onClickNavigate(routeName) {
    navigateAction = NavigationActions.navigate({
        routeName: routeName,
        params: { username: this.state.username },
    });
    this.props.navigation.dispatch(navigateAction);        
  }

  render() {
    return (
      <Container style={styles.container}>
        <MapView
          ref="map"
          style={styles.map}
          initialRegion={{
            latitude: -33.8688,
            longitude: 151.2093,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
          onPanDrag={(e) => { this.setState({isFollowingUser:false}) }}
          showsUserLocation={this.state.showsUserLocation}
          followsUserLocation={false}
          scrollEnabled={true}
          showsMyLocationButton={false}
          showsPointsOfInterest={false}
          showsScale={false}
          showsTraffic={false}
          toolbarEnabled={false}>

          <Polyline
            key="polyline"
            coordinates={this.state.coordinates}
            geodesic={true}
            strokeColor='rgba(255, 127, 0, 0.6)'
            strokeWidth={2}
            zIndex={0}
          />        

          {this.state.markers.map((marker) => (
            <MapView.Marker
              key={marker.key}
              coordinate={marker.coordinate}
              anchor={{x:0, y:0.1}}
              title={marker.title}>
              <View style={[styles.markerIcon]}></View>
            </MapView.Marker>))
          }
        </MapView>        

        <Footer style={styles.btnbackground}>
            <FooterTab>
                <Button onPress={this.onStartTracking.bind(this)} disabled={this.state.enabled} style={styles.btn}>
                  <Icon name='md-play' style={this.state.enabled ? styles.btnicondisabled: styles.btnicon}/>
                </Button>
                <Button onPress={this.onPauseTracking.bind(this)} disabled={!this.state.enabled || this.state.paused} style={styles.btn}>
                  <Icon name='md-pause' style={!this.state.enabled || this.state.paused ? styles.btnicondisabled: styles.btnicon}/>
                </Button>
                <Button onPress={this.onStopTracking.bind(this)} disabled={!this.state.enabled && !this.state.paused} style={styles.btn}>
                  <Icon type='MaterialIcons' name='stop' style={!this.state.enabled && !this.state.paused ? styles.btnicondisabled: styles.btnicon}/>
                </Button>
                <Button onPress={this.onResetMarkers.bind(this)} disabled={this.state.enabled || this.state.coordinates.length == 0} style={styles.btn}>
                  <Icon name='md-refresh' style={this.state.enabled || this.state.coordinates.length == 0 ? styles.btnicondisabled: styles.btnicon}/>
                </Button>
                <Button onPress={this.onGoToLocation.bind(this)} style={styles.btn}>
                  <Icon name='md-locate' style={this.state.isFollowingUser ? styles.btnicondisabled: styles.btnicon}/>
                </Button>
                <Button onPress={() => this.onClickNavigate('LoginScreen')} style={styles.btn}>
                  <Icon name='md-exit' style={styles.logoutbtnicon}/>
                </Button>
            </FooterTab>
        </Footer>
        <Footer style={styles.footer}>
          <Text style={styles.footertext}>{this.state.statusMessage} (v0.15)</Text>
        </Footer>
      </Container>
    );
  }
}

var styles = StyleSheet.create({
  btnbackground: {
    backgroundColor: 'orange',
  },
  btn: {
    backgroundColor: 'white',
    borderRadius: 0,
    borderWidth: 0.2,
    borderColor: 'orange',
  },
  btnicon: {
    color: 'orange',
    fontSize: 30,
    borderRadius: 0,
  },
  btnicondisabled: {
    color: 'grey',
    fontSize: 30,
    borderRadius: 0,
  },
  logoutbtnicon: {
    color: 'red',
    fontSize: 30,
    borderRadius: 0,
  },
  container: {
    backgroundColor: '#272727'
  },
  header: {
    backgroundColor: 'orange'
  },
  title: {
    color: '#000'
  },
  footer: {
    backgroundColor: 'white',
    paddingLeft: 10, 
    paddingRight: 10
  },
  footerBody: {
    justifyContent: 'center',
    width: 200,
    flex: 1
  },
  footertext: {
    color: 'orange',
    margin: 13
  },
  icon: {
    color: 'orange'
  },
  map: {
    flex: 1
  },
  status: {
    fontSize: 12
  },
  markerIcon: {
    borderWidth:1,
    borderColor:'#000000',
    backgroundColor: 'rgba(0,179,253, 0.6)',
    width: 10,
    height: 10,
    borderRadius: 5
  }
});
