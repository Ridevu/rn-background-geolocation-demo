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

import Notification from 'react-native-in-app-notification';

// Import native-base UI components
import { 
  Container,
  Button, Icon,
  Text,
  Header, Footer, Title,
  Content, 
  Left, Body, Right,
  Switch 
} from 'native-base';

////
// Import BackgroundGeolocation plugin
// Note: normally you will not specify a relative url ../ here.  I do this in the sample app
// because the plugin can be installed from 2 sources:
//
// 1.  npm:  react-native-background-geolocation
// 2.  private github repo (customers only):  react-native-background-geolocation-android
//
// This simply allows one to change the import in a single file.
import BackgroundGeolocation from '../react-native-background-geolocation';

// react-native-maps
import MapView from 'react-native-maps';
const LATITUDE_DELTA = 0.00922;
const LONGITUDE_DELTA = 0.00421;

const TRACKER_HOST = 'http://tracker.transistorsoft.com/locations/';

const dummyPoints = [
  { datetime: "2018-04-23 15:50:00", lat: "-31.868819", lon: "151.209295" },
  { datetime: "2018-04-23 15:51:00", lat: "-31.868319", lon: "151.209295" },
  { datetime: "2018-04-23 15:52:00", lat: "-31.868719", lon: "151.209295" },
  { datetime: "2018-04-23 15:53:00", lat: "-31.868119", lon: "151.209295" }
];

export default class SimpleMap extends Component<{}> {
  constructor(props) {
    super(props);

    this.state = {
      enabled: false,
      isMoving: false,
      motionActivity: {activity: 'unknown', confidence: 100},
      odometer: 0,
      username: props.navigation.state.params.username,
      // MapView
      markers: [],
      coordinates: [],
      unreportedCoordinates: [],
      showsUserLocation: false
    };
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
      distanceFilter: 10,
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
      stopOnTerminate: false,
      startOnBoot: true,
      foregroundService: true,
      debug: true,
      logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
    }, (state) => {
      this.setState({
        enabled: state.enabled,
        isMoving: state.isMoving,
        showsUserLocation: state.enabled
      });      
    });
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

  onToggleEnabled(value) {
    let enabled = !this.state.enabled;

    this.setState({
      enabled: enabled,
      isMoving: false,
      showsUserLocation: false,
    });

    if (enabled) {
      this.setState({
        coordinates: [],
        markers: []
      });
        BackgroundGeolocation.start((state) => {
        // NOTE:  We tell react-native-maps to show location only AFTER BackgroundGeolocation
        // has requested location authorization.  If react-native-maps requests authorization first,
        // it will request WhenInUse -- "Permissions Tug-of-war"
        this.setState({
          showsUserLocation: true
        });
        let isMoving = true;
        this.setState({isMoving: isMoving});
        BackgroundGeolocation.changePace(isMoving);          
        this.startAnonymousTrack();
      });
    } else {      
      BackgroundGeolocation.stop();
      console.log('Closing the track - sending remaining points to server');
      this.uploadSomePoints();
      this.closeAnonymousTrack();
    }
  }

  onClickResetMarkers() {
    this.setState({
      coordinates: [],
      markers: []
    });
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
      markers: [...this.state.markers, marker],
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
    // let markersToAsyncStorage = JSON.stringify(this.state.markers);
    // AsyncStorage.setItem('@mmp:markers_in_async_storage', markersToAsyncStorage);

    console.log('New marker set, unreported points count - ' + this.state.unreportedCoordinates.length.toString());

    if (this.state.unreportedCoordinates.length > 5)
    {
      console.log("Points ready to be uploaded - " + this.state.unreportedCoordinates.length.toString() + " points to be sent!");
      this.uploadSomePoints();
    }
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
    fetch('https://managemyapi.azurewebsites.net/Mobile.asmx/SetJobStatus', {
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
    fetch('https://managemyapi.azurewebsites.net/Mobile.asmx/SetJobStatus', {
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
      });
}

async uploadSomePoints(realPoints=true) {
  var auth_token = "";
  await AsyncStorage.getItem('@mmp:auth_token', (err, item) => auth_token = item);
  var pointsToReport = dummyPoints;
  if (realPoints)
      pointsToReport = this.state.unreportedCoordinates;
  console.log("pointsToReport = " + pointsToReport.length.toString());
  var body = JSON.stringify({
    token: auth_token,
    job_id: 0,
    points: pointsToReport
  });
  console.log("Uploading points - body = " + body);
  fetch('https://managemyapi.azurewebsites.net/Mobile.asmx/UploadTrackpoints', {
      method: 'POST',
      headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json; charset=utf-8;',
          'Data-Type': 'json'
      },
      body: body,
    })
    .then((response) => {
          console.log("Uploaded some points to track");
          this.setState({
            unreportedCoordinates: []
          });
    })
    .catch((error) =>{
          console.error(error);
    }
  );
}

  render() {
    return (
      <Container style={styles.container}>
        <Header style={styles.header}>
          <Left>
            <Switch onValueChange={() => this.onToggleEnabled()} value={this.state.enabled} />
          </Left>
          <Body>
            <Title style={styles.title}>Stop/Start</Title>
          </Body>
          <Right>
            <Button transparent onPress={this.onClickHome.bind(this)}>
              <Icon active name="md-exit" style={styles.title} />
            </Button>
          </Right>
        </Header>

        <MapView
          ref="map"
          style={styles.map}
          showsUserLocation={this.state.showsUserLocation}
          followsUserLocation={false}
          scrollEnabled={true}
          showsMyLocationButton={false}
          showsPointsOfInterest={false}
          showsScale={false}
          showsTraffic={false}
          toolbarEnabled={false}>
          <MapView.Polyline
            key="polyline"
            coordinates={this.state.coordinates}
            geodesic={true}
            strokeColor='rgba(0,179,253, 0.6)'
            strokeWidth={6}
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

        <Footer style={styles.footer}>
          <Left style={{flex:0.3}}>
            <Button info>
              <Icon active name="md-done-all" style={styles.icon} onPress={this.onClickResetMarkers.bind(this)} />
            </Button>
          </Left>
          <Body style={styles.footerBody}>
            <Text style={styles.status}>{this.state.motionActivity.activity}:{this.state.motionActivity.confidence}% &middot; {this.state.odometer}km</Text>
          </Body>
        </Footer>
        <Notification ref={(ref) => { this.notification = ref; }} />
      </Container>
    );
  }

  /**
  * Dispatch back to HomeScreen Application-switcher
  */
  onClickHome() {
    // Tell MapView to stop updating location
    this.setState({
      showsUserLocation: false
    });
    
    App.goHome(this.props.navigation);
  }  
}

var styles = StyleSheet.create({
  container: {
    backgroundColor: '#272727'
  },
  header: {
    backgroundColor: '#fedd1e'
  },
  title: {
    color: '#000'
  },
  footer: {
    backgroundColor: '#fedd1e',
    paddingLeft: 10, 
    paddingRight: 10
  },
  footerBody: {
    justifyContent: 'center',
    width: 200,
    flex: 1
  },
  icon: {
    color: '#fff'
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
