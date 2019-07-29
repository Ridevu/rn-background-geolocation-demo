import React, { Component } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  AsyncStorage,
  TouchableHighlight,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';

// For dispatching back to HomeScreen
import App from '../App';

// For posting to tracker.transistorsoft.com
import DeviceInfo from 'react-native-device-info';
import email from 'react-native-email'

import { NavigationActions, StackActions } from 'react-navigation';

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
import {PROVIDER_GOOGLE} from 'react-native-maps';

import BackgroundGeolocation from '../react-native-background-geolocation-android';

const LATITUDE_DELTA = 0.00922;
const LONGITUDE_DELTA = 0.00421;

const TRACKER_HOST = 'http://tracker.transistorsoft.com/locations/';

const MMP_URL_UPLOAD_COMPLETE_TRACK = 'https://managemyapiclone.azurewebsites.net/Mobile.asmx/UploadCompleteTrackWithPOIsToJob'
const COORDINATES_BUFFER_LENGTH = 2  ;

export default class SimpleMap extends Component<{}> {
  constructor(props) {
    super(props);

    this.state = {
      enabled: false,
      paused: false,
      isMoving: false,
      motionActivity: {activity: 'unknown', confidence: 100},
      username: props.navigation.state.params.username,
      // MapView
      markers: [],
      coordinates: [],
      unreportedCoordinates: [],
      jobPolygons: [],
      jobPolygonsCoordinates: [],
      trackIDs: [],
      tracks: [],
      showsUserLocation: true,
      statusMessage: 'Waiting to start tracking',
      isFollowingUser: true,
      modalVisible: false,
      poisModalVisible: false,
      odometer: 0,
      speed: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      trackStartTime: 0,
      trackTimeStr: '00:00:00',
      textForPOI: '',
    };
    AsyncStorage.setItem("@mmp:next_page", 'SimpleMap');
}

  async componentDidMount() {
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
      stopTimeout: 30,

      stopOnTerminate: false,
      startOnBoot: true,
      foregroundService: true,
      preventSuspend: true,
      heartbeatInterval: 60,
      forceReloadOnHeartbeat: true,
      minimumActivityRecognitionConfidence: 50,

      debug: false,
      logLevel: BackgroundGeolocation.LOG_LEVEL_OFF,
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

        stopOnTerminate: false,
        startOnBoot: true,
        foregroundService: true,
        preventSuspend: true,
        heartbeatInterval: 60,
        forceReloadOnHeartbeat: true,
        minimumActivityRecognitionConfidence: 50,
        debug: false,
        logLevel: BackgroundGeolocation.LOG_LEVEL_WARNING,

        locationTemplate: '{ "timestamp":"<%= timestamp %>", "latitude":"<%= latitude %>", "longitude":"<%= longitude %>", "altitude":"<%= altitude %>" }',
        params: { extras: { "token": item }}
      });
    });

    try {
      await AsyncStorage.getItem('@mmp:job_id', (err, item) => { 
        this.setState({
          jobPolygons: [],
          jobPolygonsCoordinates: []
        });
        if(item !== null && item !== undefined && item !== "0") {
          this.LoadJobData(parseInt(item));
        }
        else {
          this.onGoToLocation();
        }
      });
    }
    catch(exception) {
    }

    AsyncStorage.getItem('mmp_username')
      .then((mmp_username) => {
        AsyncStorage.getItem('mmp_password')
        .then((mmp_password) => {
          fetch('https://managemyapi.azurewebsites.net/Mobile.asmx/AuthRequest', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json; charset=utf-8;',
              'Data-Type': 'json'
            },
            body: JSON.stringify({
              username: mmp_username,
              password: mmp_password,
              device_id: DeviceInfo.getUniqueID()
            }),
          })
          .then((response) => response.json())
          .then((responseJson) => {
              if(responseJson.d.auth_result == 0) {
                  AsyncStorage.setItem('@mmp:auth_token', responseJson.d.token);
                  AsyncStorage.setItem('@mmp:user_id', responseJson.d.user.user_id.toString());
              }
              else {
                this.onClickNavigate('LoginScreen');    
              }
          })
          .catch((error) =>{
              console.error(error);
              this.onClickNavigate('LoginScreen');    
          });
    })});
  }

  /**
  * @event location;
  * 
  */
  onLocation(location) {
    if (!location.sample) {
      this.addMarker(location);
      this.setState({
        odometer: (location.odometer/1000),
        speed: location.coords.speed != -1 ? location.coords.speed*3.6 : this.state.speed,
        averageSpeed: (location.odometer/1000) / ((Date.now() - this.state.trackStartTime) / 3600000.0),
        maxSpeed: location.coords.speed*3.6 > this.state.maxSpeed ? location.coords.speed*3.6 : this.state.maxSpeed,
        trackTimeStr: this.toHHMMSS((Date.now() - this.state.trackStartTime)/1000),
      });
    }

    if(this.state.isFollowingUser)
      this.setCenter(location);
  }
  /**
  * @event motionchange
  */
  onMotionChange(event) {
    this.setState({
      isMoving: event.isMoving
    });
    let location = event.location;    
  }
  /**
  * @event activitychange
  */
  onActivityChange(event) {
    this.setState({
      motionActivity: event
    });
  }
  /**
  * @event providerchange
  */
  onProviderChange(event) {
  }
  /**
  * @event powersavechange
  */
  onPowerSaveChange(isPowerSaveMode) {
  }

  onEnteredPOI(newPOIName) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        AsyncStorage.getItem('@mmp:POIs', (err, item) => this.addPOIToStorage(item, position, newPOIName));
      }
    );    
  }

  addPOIToStorage(existingPOIsString, newPOIPosition, newPOIName) {
    var timestampFormatted = '2000-01-01 00:00:00';
    if(existingPOIsString == null || existingPOIsString.length == 0 || existingPOIsString == 'null')
      existingPOIsString = '';
    if(existingPOIsString.length > 0)
      existingPOIsString += ',\n'
    newPOIsString = existingPOIsString + '{"Latitude":"' + newPOIPosition.coords.latitude.toString() + '","Longitude":"' + newPOIPosition.coords.longitude.toString() + '","Timestamp":"' + timestampFormatted + '", "Name": "' + newPOIName + '"}';
    AsyncStorage.setItem("@mmp:POIs", newPOIsString);
  }

  onGoToLocation() {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        let curr_latitude = position.coords.latitude;
        let curr_longitude = position.coords.longitude;
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
    BackgroundGeolocation.resetOdometer();
    this.setState({
      enabled: true,
      paused: false,
      statusMessage: 'Now tracking...',
      isMoving: false,
      showsUserLocation: false,
      componentStarted: true,
      odometer: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      trackStartTime: Date.now(),
      trackTimeStr: '00:00:00',
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
  }

  async onStopTracking(value) {
    this.setState({
      enabled: false,
      paused: false,
      statusMessage: 'Sending last location points to server',
      isMoving: false,
      showsUserLocation: false,
    });

    AsyncStorage.setItem("@mmp:enabled", 'false');
    AsyncStorage.setItem("@mmp:paused", 'false');
    
    var locationsFormatted = [];
    let locations = await BackgroundGeolocation.getLocations();
    for(var i = 0; i < locations.length; i++)
    {
      var timestampFormatted = locations[i].timestamp.replace('T', ' ').replace('Z', '').substring(0, 19);

      var pointInString = JSON.stringify(locations[i]);
  
      locationsFormatted.push({ lat: locations[i].latitude, lon: locations[i].longitude, alt: locations[i].altitude, datetime: timestampFormatted });
    }

    BackgroundGeolocation.stop();
    this.setState({
      isMoving: false,
      showsUserLocation: false,
    });

    this.setState({
      statusMessage: 'Track being uploaded...',
    });

    var auth_token = "";
    await AsyncStorage.getItem('@mmp:auth_token', (err, item) => auth_token = item);

    var jobId = "";
    await AsyncStorage.getItem('@mmp:job_id', (err, item) => jobId = item);

    var POIsFormatted = '[]';
    var POIsFromAsyncStorage = '';
    await AsyncStorage.getItem('@mmp:POIs', (err, item) => POIsFromAsyncStorage = item);
    if(POIsFromAsyncStorage != null)
    {
      POIsFormatted = '[' + POIsFromAsyncStorage + ']';
    }
    var POIsJSON = JSON.parse(POIsFormatted);

    var requestPayload = JSON.stringify({
      token: auth_token,
      job_id: jobId,
      points: locationsFormatted,
      trackPOIs: POIsJSON,
    });

    fetch(MMP_URL_UPLOAD_COMPLETE_TRACK, {
      method: 'POST',
      headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8;',
      'Data-Type': 'json'
      },
      body: requestPayload,
    })
    .then((response) => response.json())
    .then((responseJson) => {
        if('d' in responseJson && responseJson.d.result == 0) {
          BackgroundGeolocation.destroyLocations(function() {
          });
          this.setState({
            statusMessage: locationsFormatted.length.toString() + ' points uploaded to job #' + jobId.toString(),
          });
        }
        else {
          this.setState({
            statusMessage: 'Error (will email GPX file)',
          });
          this.sendTrackGPXAsEmail(locations);
          BackgroundGeolocation.destroyLocations();
        }
    })
    .catch((error) =>{
        console.error(error);
    });
  }

  async sendTrackGPXAsEmail(locations) {
    if(locations.length <= 0)
      return;

    var headerText = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
    <gpx xmlns="http://www.topografix.com/GPX/1/1"
     creator="Ynamics LoggerLib" version="1.1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
     `;
    var gpxName = locations[0].timestamp;
    var filename = gpxName + '.gpx';
    var metadata = '<metadata><name>' + gpxName + '</name></metadata>\n'
    var body = '';
    for(var i = 0; i < locations.length; i++)
    {
      body += '<wpt lat="' + locations[i].latitude + '" lon="' + locations[i].longitude + '" >\n';
      body += '<ele>' + locations[i].altitude + '</ele>\n';
      body += '<time>' + locations[i].timestamp + '</time>\n';
      body += '<name>wpt-' + locations[i].timestamp + '</name>\n';
      body += `<type></type>
      </wpt>
      `;
    }
    body += '<trk><trkseg>\n';
    for(var i = 0; i < locations.length; i++)
    {
      body += '<trkpt lat="' + locations[i].latitude + '" lon="' + locations[i].longitude + '" >\n';
      body += '<ele>' + locations[i].altitude + '</ele>\n';
      body += '<time>' + locations[i].timestamp + '</time>\n';
      body += '<name>wpt-' + locations[i].timestamp + '</name>\n';
      body += `<type></type>
      </trkpt>
      `;
    }
    body += '</trkseg></trk>\n';
    body += '</gpx>';

    var fileContent = headerText + metadata + body;

    const to = ['operations@dand.com.au'] // string or array of email addresses
    email(to, {
        // Optional additional arguments
        subject: 'Track Upload Malfunction - GPX Content',
        body: fileContent
    }).catch(console.error);
  }
  
  onResetMarkers() {
    this.setState({
      coordinates: [],
      markers: [],
      odometer: 0,
      speed: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      trackStartTime: 0,
      trackTimeStr: '00:00:00',
    });
    AsyncStorage.setItem("@mmp:locations", '{"locations": []}');
    AsyncStorage.setItem("@mmp:POIs", '');
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

  async LoadJobData(jobId) {
    if(jobId == 0) {
      this.onGoToLocation();
      return;
    }
    var auth_token = "";

    await AsyncStorage.getItem('@mmp:auth_token', (err, item) => auth_token = item);
        
    this.setState({
      jobId: jobId,
      auth_token: auth_token
    });        

    fetch('https://managemyapi.azurewebsites.net/Mobile.asmx/GetJob', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json; charset=utf-8;',
          'Data-Type': 'json'
        },
        body: JSON.stringify({
          token: auth_token,
          job_id: jobId,
          get_job_detail: 1
        }),
    })
    .then((response) => response.json())
    .then((responseJson) => {
        var polygons = [];
        var jobPolygonsCoordinates = [];
        for(var i = 0; i < responseJson.d.areas.length; i++) {
          var points = [];
          var currentPolygon = responseJson.d.areas[i];
          for(var j = 0; j < currentPolygon.positions.length; j++)
          {
            points.push({ latitude: currentPolygon.positions[j].lat, longitude: currentPolygon.positions[j].lon });
            jobPolygonsCoordinates.push({ latitude: currentPolygon.positions[j].lat, longitude: currentPolygon.positions[j].lon });
          }
          if(points.length > 3)
          {
            polygons.push({points});
          }
          points = [];
        }

        trackIDs = [];
        for(var i = 0; i < responseJson.d.tracks.length; i++) {
          trackIDs.push(parseInt(responseJson.d.tracks[i].track_id, 10));
        }

        this.setState({
          jobPolygons: polygons,
          jobPolygonsCoordinates: jobPolygonsCoordinates,
          trackIDs: trackIDs
        });

        if(this.state.jobPolygonsCoordinates.length > 1) {
          this.refs.map.fitToCoordinates(this.state.jobPolygonsCoordinates, { edgePadding: { top: 10, right: 10, bottom: 10, left: 10 }, animated: true });
        }
        else {
          this.onGoToLocation();
        }

        this.setState({
          statusMessage: 'Job ' + jobId.toString() + ' loaded with ' + this.state.jobPolygons.length.toString() + ' polygons',
        });        
    })
    .catch((error) =>{
    });
  }

  setModalVisible(visible) {
    this.setState({modalVisible: visible});
  }

  setPoisModalVisible(visible) {
    this.setState({poisModalVisible: visible});
  }

  async ToggleLoadJobMissedAddresses() {
    if(this.state.missedAddressesLoaded)
    {
      this.setState({
        missedAddresses: [],
        missedAddressesLoaded: false
      });
      return;
    }

    var trackIDs = this.state.trackIDs;
    var tracks = [];
    for(var i = 0; i < trackIDs.length; i++) {
      var trackID = trackIDs[i];
      fetch('https://managemyapiclone.azurewebsites.net/Mobile.asmx/GetTrackSegments', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json; charset=utf-8;',
          'Data-Type': 'json'
        },
        body: JSON.stringify({
          token: this.state.auth_token,
          track_id: trackID
        }),
      })
      .then((response) => response.json())
      .then((responseJson) => {
          var trackPoints = [];
          for(var j = 0; j < responseJson.d.length; j++) {
            var point = responseJson.d[j];
            trackPoints.push({ latitude: point.latitude, longitude: point.longitude });
          }
          tracks.push({ track_id: trackID, points: trackPoints });
          if(tracks.length > 0)
            this.setState({ tracks: tracks });
      })
      .catch((error) =>{
          console.error(error);
      });
    }
  }

  CollectMissedAddresses() {
    var tracks = this.state.tracks;
    var polygons = this.state.jobPolygons;

    var geom_str = '';
    var i = 0;
    while(true) {
      currentPolygon = polygons[i].points;
      var j = 0;
      geom_str += '(';
      while(true) {
        geom_str += currentPolygon[j].longitude.toString() + ' ' + currentPolygon[j].latitude.toString();
        if(++j >= currentPolygon.length)
          break;
        geom_str += ',';
      }
      geom_str += ')';
      if(++i >= polygons.length)
        break;
      geom_str += ',';
    }

    for(var i = 0; i < tracks.length; i++) {
      var multiline_str = '';
      var currentTrack = tracks[i].points;
      if(currentTrack.length < 3) {
        if(i >= tracks.length)
          break;
        continue;
      }
      var j = 0;
      multiline_str += '(';
      while(true) {
        multiline_str += currentTrack[j].longitude.toString() + ' ' + currentTrack[j].latitude.toString();
        if(++j >= currentTrack.length)
          break;
        multiline_str += ','
      }
      multiline_str += ')';
    }

    fetch('https://managemyapiclone.azurewebsites.net/Mobile.asmx/ProxyMissedAddresses', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8;',
        'Data-Type': 'json'
      },
      body: JSON.stringify({
        token: this.state.auth_token,
        geom_str: geom_str,
        multiline_str: multiline_str
      }),
    })
    .then((response) => response.json())
    .then((responseJson) => {
    })
    .catch((error) =>{
    });

    this.setState({ missedAddressesLoaded: true });
  }

  goToStartPage() {
    this.setState({
      jobPolygons: [],
    });
    const resetAction = StackActions.reset({
      index: 0,
      actions: [NavigationActions.navigate({ routeName: 'StartPage' })],
    });
    this.props.navigation.dispatch(resetAction);
  }

  toHHMMSS(sec_num) {
    if(sec_num == 0)
      return '';
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = Math.floor(sec_num - (hours * 3600) - (minutes * 60));

    hoursStr = hours.toString();
    if (hours   < 10) {hoursStr = "0"+hoursStr;}
    minutesStr = minutes.toString();
    if (minutes < 10) {minutesStr = "0"+minutesStr;}
    secondsStr = seconds.toString();
    if (seconds < 10) {secondsStr = "0"+secondsStr;}
    return hoursStr+':'+minutesStr+':'+secondsStr;
}

  render() {
    return (
      <Container style={styles.container}>
        <View style={styles.viewincontainer}>
          <Button onPress={() => this.setModalVisible(!this.state.modalVisible)} style={{zIndex: 100, backgroundColor: 'rgba(255, 255, 255, 0.8)', position: 'absolute', top: 25, left: 5}}>
            <Icon name='md-stats' style={{color: 'orange', backgroundColor: 'transparent'}}/>
          </Button>
          <Button onPress={() => this.setPoisModalVisible(!this.state.poisModalVisible)} style={{zIndex: 100, backgroundColor: 'rgba(255, 255, 255, 0.8)', position: 'absolute', top: 25, right: 5}}>
            <Icon name='md-medical' style={{color: 'orange', backgroundColor: 'transparent'}}/>
          </Button>
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

            {/* {this.state.missedAddresses.map((address, index) => (
              <Marker
                key={'address' + index}
                coordinate={address.coordinate}
                anchor={{x:0, y:0.1}}>
              </Marker>))
            } */}

            {/* {this.state.tracks.map((track, index) => (
              <Polyline
                key={'track' + index}
                coordinates={track.points}
                geodesic={true}
                strokeColor='rgba(0, 127, 127, 0.6)'
                strokeWidth={2}
                zIndex={0}>
              </Polyline>))
            } */}



            {this.state.jobPolygons.map((polygon, index) => (
              <MapView.Polygon
                key={"polygon" + index.toString()}
                strokeColor={"grey"}
                strokeWidth={2}
                fillColor={"rgba(100,100,150,0.1)"}
                coordinates={polygon.points} />))
              }
            </MapView>

          <Modal
            animationType="slide"
            transparent={true}
            visible={this.state.modalVisible}
            onRequestClose={() => {
              Alert.alert('Modal has been closed.');
            }}>
            <View style={{marginTop: 20, marginBottom: 120, marginLeft: 20, marginRight: 20, backgroundColor: 'rgba(255, 255, 255, 0.8)'}}>
              <ScrollView>
                <KeyboardAvoidingView style={styles.container} behavior="padding" enabled>
                  <Button onPress={() => this.setModalVisible(!this.state.modalVisible)} style={{backgroundColor: 'transparent'}}>
                      <Icon name='md-close' style={{color: 'orange', backgroundColor: 'transparent'}}/>
                  </Button>
                  <Text style={styles.headertext}>{'Statistics:'}</Text>
                  <Text style={styles.footertext}>
                    {'Distance: ' + this.state.odometer.toFixed(1) + ' km\n'}
                    {'Time: ' + this.state.trackTimeStr + '\n'}
                    {'Current Speed: ' + this.state.speed.toFixed(1) + ' km/h\n'}
                    {'Average Speed: ' + this.state.averageSpeed.toFixed(1) + ' km/h\n'}
                    {'Top Speed: ' + this.state.maxSpeed.toFixed(1) + ' km/h\n'}
                  </Text>
                </KeyboardAvoidingView>
              </ScrollView>
            </View>
          </Modal>

          <Modal
            animationType="slide"
            transparent={true}
            visible={this.state.poisModalVisible}
            onRequestClose={() => {
              Alert.alert('Modal has been closed.');
            }}>
            <View style={{marginTop: 20, marginBottom: 120, marginLeft: 20, marginRight: 20, backgroundColor: 'rgba(255, 255, 255, 0.8)'}}>
              <ScrollView>
                <KeyboardAvoidingView style={styles.container} behavior="padding" enabled>
                  <Button onPress={() => this.setPoisModalVisible(!this.state.poisModalVisible)} style={{backgroundColor: 'transparent'}}>
                      <Icon name='md-close' style={{color: 'orange', backgroundColor: 'transparent'}}/>
                  </Button>
                  <Text style={styles.headertext}>{'POIs Entry:'}</Text>
                  <Button
                    style={styles.poibtn}
                    title='Could not enter' onPress={() => this.onEnteredPOI('Could not enter')}
                  >
                    <Text style={styles.btntext}>Could not enter</Text>
                  </Button>
                  <Button
                    style={styles.poibtn}
                    title='No Letterbox' onPress={() => this.onEnteredPOI('No Letterbox')}
                  >
                    <Text style={styles.btntext}>No Letterbox</Text>
                  </Button>
                  <Button
                    style={styles.poibtn}
                    title='One letterbox in the building' onPress={() => this.onEnteredPOI('One letterbox in the building')}
                  >
                    <Text style={styles.btntext}>One letterbox in the building</Text>
                  </Button>

                  <TextInput 
                    style={styles.textinput}
                    multiline={false}
                    underlineColorAndroid="transparent"
                    onChangeText={(text) => this.setState({textForPOI: text})}
                    value={this.state.textForPOI}
                    placeholder = 'POI description'
                  />       
                  <Button
                    style={styles.poibtn}
                    title='Load empty map'
                    onPress={() => this.onEnteredPOI(this.state.textForPOI)}
                  >
                    <Text style={styles.btntext}>Add bespoke POI</Text>
                  </Button>


                </KeyboardAvoidingView>

              </ScrollView>

            </View>
          </Modal>
        </View>
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
            {/* <Button onPress={this.ToggleLoadJobMissedAddresses.bind(this)} style={styles.btn}>
              <Icon name='md-alert' style={this.state.missedAddressesLoaded ? styles.btnicon: styles.btnicondisabled}/>
            </Button> */}
            <Button onPress={() => this.goToStartPage()} style={styles.btn}>
              <Icon name='md-exit' style={styles.logoutbtnicon}/>
            </Button>
          </FooterTab>
        </Footer>
        <Footer style={styles.footer}>
          <Text style={styles.footertext}>{this.state.statusMessage}</Text>
        </Footer>
      </Container>
    );
  }
}

var styles = StyleSheet.create({
  btnbackground: {
    backgroundColor: 'orange',
  },
  btntext: {
    flex: 1,
    textAlign: 'center',
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
  poibtn : {
    backgroundColor: 'orange',
    borderRadius: 10,
    margin: 10,
  },
  container: {
    backgroundColor: '#272727'
  },
  footer: {
    backgroundColor: 'white',
    paddingLeft: 10, 
    paddingRight: 10
  },
  footertext: {
    color: 'orange',
    margin: 13
  },
  headertext: {
    color: 'orange',
    fontSize: 24,
    margin: 10,
  },
  map: {
    // marginTop: 1.5,
    ...StyleSheet.absoluteFillObject,
  },
  viewincontainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerIcon: {
    borderWidth:1,
    borderColor:'#000000',
    backgroundColor: 'rgba(0,179,253, 0.6)',
    width: 10,
    height: 10,
    borderRadius: 5
  },
  textinput: {
    fontSize: 18,
    fontWeight: "600",
    height: 50,
    color: 'white',
    alignSelf: 'stretch',
    alignItems: 'center',
    padding: 14,
    margin: 8,
    backgroundColor: 'rgba(255, 165, 00, 0.4)',
    borderColor: '#fff',
    borderWidth: 0.6,
    borderRadius: 10,
    justifyContent: 'flex-start',
  },
  container2: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  textinput2: {
    fontSize: 18,
    fontWeight: "600",
    height: 50,
    color: 'white',
    alignSelf: 'stretch',
    alignItems: 'center',
    padding: 14,
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 25,
    backgroundColor: 'rgba(255, 165, 00, 0.4)',
    borderColor: '#fff',
    borderWidth: 0.6,
    borderRadius: 10,
    justifyContent: 'flex-start',
  }
});
