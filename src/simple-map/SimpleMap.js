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
  Alert,
} from 'react-native';

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

import BackgroundGeolocation from '../react-native-background-geolocation';

const LATITUDE_DELTA = 0.00922;
const LONGITUDE_DELTA = 0.00421;

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
      oldTracks: [],
      lastLat: 0.0,
      lastLong: 0.0
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
    BackgroundGeolocation.ready({
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

    var trackingEnabled = '';
    await AsyncStorage.getItem('@mmp:enabled', (err, item) => { 
      trackingEnabled = item;
    });

    if(trackingEnabled != 'true')
    {
      var storedAppVersion = '';
      var appVersion = DeviceInfo.getVersion();
      await AsyncStorage.getItem('@mmp:appVersion', (err, storedAppVersion) => {});
  
        if(storedAppVersion != appVersion) {
        console.log('Versions: Version is ' + appVersion + '. Gonna have to wipe out some async storage');
        await AsyncStorage.multiRemove(['@mmp:enabled', '@mmp:paused', '@mmp:POIs']);
        await AsyncStorage.setItem('@mmp:locations', '{"locations": []}');
        await AsyncStorage.setItem('@mmp:old_tracks', '{"old_tracks": []}');
        await AsyncStorage.setItem('@mmp:appVersion', appVersion);
      }  
    }

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
    AsyncStorage.getItem('@mmp:old_tracks', (err, item) => this.loadOldTracksFromStorage(item));

    AsyncStorage.getItem('@mmp:auth_token', (err, item) => { 
      this.setState({auth_token: item});
      BackgroundGeolocation.ready({

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
          fetch('https://managemyapiclone.azurewebsites.net/Mobile.asmx/AuthRequest', {
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

  onClickNavigate(routeName) {
    navigateAction = NavigationActions.navigate({
        routeName: routeName,
        params: { username: this.state.username },
    });
    this.props.navigation.dispatch(navigateAction);        
  }


  /**
  * @event location;
  * 
  */
  onLocation(location) {
    if (!location.sample) {
      if(this.state.enabled && !this.state.paused)
        this.addMarker(location);
      this.setState({
        odometer: (location.odometer/1000),
        speed: location.coords.speed != -1 ? location.coords.speed*3.6 : this.state.speed,
        averageSpeed: (location.odometer/1000) / ((Date.now() - this.state.trackStartTime) / 3600000.0),
        maxSpeed: location.coords.speed*3.6 > this.state.maxSpeed ? location.coords.speed*3.6 : this.state.maxSpeed,
        trackTimeStr: this.toHHMMSS((Date.now() - this.state.trackStartTime)/1000),
        lastKnownLocation: location,
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
    AsyncStorage.getItem('@mmp:POIs', (err, item) => this.addPOIToStorage(item, this.state.lastKnownLocation, newPOIName));
    let markers = this.state.markers;
    markers.push({label: newPOIName, coordinate: this.state.lastKnownLocation.coords});
    this.setState({markers: markers});    
  }

  addPOIToStorage(existingPOIsString, newPOIPosition, newPOIName) {
    var timestampFormatted = this.getNowFormatted();
    if(existingPOIsString == null || existingPOIsString.length == 0 || existingPOIsString == 'null')
      existingPOIsString = '';
    if(existingPOIsString.length > 0)
      existingPOIsString += ',\n'
    newPOIsString = existingPOIsString + '{"Latitude":"' + newPOIPosition.coords.latitude.toString() + '","Longitude":"' + newPOIPosition.coords.longitude.toString() + '","Timestamp":"' + timestampFormatted + '", "Name": "' + newPOIName + '"}';
    AsyncStorage.setItem("@mmp:POIs", newPOIsString);
  }

  getNowFormatted() {
    var now = new Date();
    return now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + ' ' + now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds();
  }

  onGoToLocation() {
    BackgroundGeolocation.getCurrentPosition({persist: false, samples: 1},
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

  async onStartTracking(value) {
    try {
      BackgroundGeolocation.getCurrentPosition({persist: false, samples: 1}).then((location) => {
        BackgroundGeolocation.resetOdometer();
        BackgroundGeolocation.start((state) => {
          this.setState({
            showsUserLocation: true
          });
          
          this.setState({
            enabled: true,
            paused: false,
            statusMessage: 'Now tracking...',
            isMoving: false,
            showsUserLocation: true,
            componentStarted: true,
            odometer: 0,
            averageSpeed: 0,
            maxSpeed: 0,
            trackStartTime: Date.now(),
            trackTimeStr: '00:00:00',
          });
      
          let isMoving = true;
          this.setState({isMoving: isMoving});
          BackgroundGeolocation.changePace(isMoving);
  
          AsyncStorage.setItem("@mmp:enabled", 'true');
          AsyncStorage.setItem("@mmp:paused", 'false'); 
        });  
      });
    }
    catch(error) {
      this.setState({statusMessage: 'No device location; tracking disabled!'});
      Alert.alert(
        "Can't access device location",
        "The app could not access the device location, and tracking has not started. It's likely due to insufficient permission. It's recommended to grant the app permission to access the device location, 'Always'.",
        [
          {
            text: 'Dismiss',
            style: 'cancel',
          },
        ],
      );
    }
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
    var locations = this.state.coordinates;
    for(var i = 0; i < locations.length; i++)
    {
      locationsFormatted.push({ lat: this.state.coordinates[i].latitude, lon: this.state.coordinates[i].longitude, alt: this.state.coordinates[i].altitude, datetime: this.state.coordinates[i].datetime });
    }

    BackgroundGeolocation.stop();
    this.setState({
      isMoving: false,
      showsUserLocation: false,
    });
    
    if(locationsFormatted.length == 0){
      this.setState({
        statusMessage: 'No locations to upload...',
      });
      return;
    }

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

    var numOfTries = 3;
    this.setState({
      trackUploadedSuccessfully: false,
    });
    while(numOfTries > 0) {
      console.log("Delayed upload: trying to upload");
      await this.uploadTrack(requestPayload);
      if(this.state.trackUploadedSuccessfully) {
        console.log("Delayed upload: upload successful");
        numOfTries = 0;
        this.setState({
          statusMessage: locationsFormatted.length.toString() + ' points uploaded to job #' + jobId.toString(),
        });
        break;
      }
      else {
        console.log("Delayed upload: upload failed");
        numOfTries--;
          await this.sleep(2000);
      }
    }
    if(this.state.trackUploadedSuccessfully) {
      let previousOldTracks = this.state.oldTracks;
      previousOldTracks.push(this.state.coordinates);
      BackgroundGeolocation.destroyLocations();
      this.setState({
        oldTracks: previousOldTracks,
        coordinates: [],
        unreportedCoordinates: []
      });
      AsyncStorage.setItem("@mmp:locations", '{"locations": []}');
      AsyncStorage.setItem("@mmp:POIs", '');
    }
    else {
      this.setState({
        statusMessage: 'Error uploading - try again later (tracking paused)',
      });
      // await this.sendTrackGPXAsEmail(locations);
      this.setState({
        enabled: false,
        paused: true,
        statusMessage: 'Tracking paused, but track still open',
        isMoving: false,
        showsUserLocation: false,
      });
  
      AsyncStorage.setItem("@mmp:enabled", 'false');
      AsyncStorage.setItem("@mmp:paused", 'true');    
    }
  }

  async uploadTrack(requestPayload) {
    try {
      let response = await fetch(MMP_URL_UPLOAD_COMPLETE_TRACK, {
        method: 'POST',
        headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8;',
        'Data-Type': 'json'
        },
        body: requestPayload,
      });
      let responseJson = await response.json();
      if('d' in responseJson && responseJson.d.result == 0) {
        this.setState({
          trackUploadedSuccessfully: true,
        });
      }
    }
    catch(error) {
      console.error(error);
    }
  }

  async sleep(milliseconds){
    return new Promise(resolve => setTimeout(resolve, milliseconds))
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
      oldTracks: [],
      markers: [],
      odometer: 0,
      speed: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      trackStartTime: 0,
      trackTimeStr: '00:00:00',
    });
    AsyncStorage.setItem("@mmp:locations", '{"locations": []}');
    AsyncStorage.setItem("@mmp:old_tracks", '{"old_tracks": []}');
    AsyncStorage.setItem("@mmp:POIs", '');
  }

  padDateTimeElements(input)
  {
      return ('0' + input.toString()).slice(-2);
  }
    
  stringifyTime(timeInput)
  {
    let timeString =  timeInput.getUTCFullYear().toString() + '-' +
    this.padDateTimeElements(timeInput.getUTCMonth()+1) + '-' +
    this.padDateTimeElements(timeInput.getUTCDate()) + ' ' +
    this.padDateTimeElements(timeInput.getUTCHours()) + ':' +
    this.padDateTimeElements(timeInput.getUTCMinutes()) + ':' +
    this.padDateTimeElements(timeInput.getUTCSeconds());
    return timeString;
  }

  addMarker(location) {
    if(location.coords.latitude == this.state.lastLat && location.coords.longitude == this.state.lastLong)
      return;
    var timeString = this.stringifyTime(new Date());
    this.setState({
      coordinates: [...this.state.coordinates, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude,
        datetime: timeString
      }],
      unreportedCoordinates: [...this.state.unreportedCoordinates, {
        "datetime": this.stringifyTime(new Date()),
        lat: location.coords.latitude,
        lon: location.coords.longitude
      }],
      lastLat: location.coords.latitude,
      lastLong: location.coords.longitude
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

  saveOldTracksToStorage() {
    let oldTracksJson = JSON.stringify({
      old_tracks: this.state.oldTracks
    });
    AsyncStorage.setItem("@mmp:old_tracks", oldTracksJson);
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

  loadOldTracksFromStorage(oldTracksJson) {
    if(oldTracksJson) {
      let oldTracks = JSON.parse(oldTracksJson).old_tracks;    
      if(oldTracks)
        this.setState({ oldTracks: oldTracks });
    }
    else
      this.setState({ oldTracks: [] });
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

    fetch('https://managemyapiclone.azurewebsites.net/Mobile.asmx/GetJob', {
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
          statusMessage: 'Job ' + jobId.toString() + ' loaded with ' + this.state.jobPolygons.length.toString() + ' polygon(s)',
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
            onPress={(e) => { this.setState({isFollowingUser:false}) }}
            // onRegionChange={(e) => { this.setState({isFollowingUser:false}) }}
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

            {this.state.oldTracks.map((oldTrack, index) => (
              <Polyline
                key={"polyline" + index.toString()}
                coordinates={oldTrack}
                geodesic={true}
                strokeColor='rgba(255, 0, 0, 0.6)'
                strokeWidth={2}
                zIndex={0}
              />
            ))}

            {this.state.markers.map((marker, index) => (
              <MapView.Marker
                key={'POI' + index}
                title={marker.label}
                coordinate={marker.coordinate}
                anchor={{x:0, y:0.1}}>
              </MapView.Marker>))
            }

            {this.state.jobPolygons.map((polygon, index) => (
              <MapView.Polygon
                key={"polygon" + index.toString()}
                strokeColor={"grey"}
                strokeWidth={2}
                fillColor={"rgba(100,100,150,0.1)"}
                coordinates={polygon.points}
              />
            ))}
            </MapView>

          <Modal
            animationType="slide"
            transparent={true}
            visible={this.state.modalVisible}
            onRequestClose={() => {
              Alert.alert('Modal has been closed.');
            }}>
            <View style={{marginTop: 50, marginBottom: 120, marginLeft: 20, marginRight: 20, backgroundColor: 'rgba(255, 255, 255, 0.8)'}}>
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
            <View style={{marginTop: 50, marginBottom: 120, marginLeft: 20, marginRight: 20, backgroundColor: 'rgba(255, 255, 255, 0.8)'}}>
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
            <Button onPress={this.onResetMarkers.bind(this)} disabled={this.state.enabled || (this.state.coordinates.length == 0 && this.state.oldTracks.length == 0)} style={styles.btn}>
              <Icon name='md-refresh' style={this.state.enabled || (this.state.coordinates.length == 0 && this.state.oldTracks.length == 0) ? styles.btnicondisabled: styles.btnicon}/>
            </Button>
            <Button onPress={this.onGoToLocation.bind(this)} style={styles.btn}>
              <Icon name='md-locate' style={this.state.isFollowingUser ? styles.btnicondisabled: styles.btnicon}/>
            </Button>
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

