
import React, { Component } from 'react';
import {
  Platform,
  StyleSheet,
  AsyncStorage,
  Alert,
  Linking,
  Image,
  ImageBackground,
  View,
  ActivityIndicator
} from 'react-native';
import { NavigationActions, StackActions } from 'react-navigation';
import {
  Container, Header, Content, Footer,
  Left, Body, Right,
  Card, CardItem,
  Text, H1,
  Button, Icon,
  Title,
  Form, Item, Input, Label
} from 'native-base';

import BackgroundGeolocation from "../react-native-background-geolocation-android";

// import prompt from 'react-native-prompt-android';

import App from '../App';

const DEFAULT_USERNAME = "react-native-anonymous";
const TRACKER_HOST = 'http://tracker.transistorsoft.com/';
const USERNAME_KEY = '@transistorsoft:username';

// Only allow alpha-numeric usernames with '-' and '_'
const USERNAME_VALIDATOR =  /^[a-zA-Z0-9_-]*$/;

export default class Home extends Component<{}> {
  constructor(props) {
    super(props);

    let navigation = props.navigation;
    this.state = {
      username: navigation.state.params.username,
      url: TRACKER_HOST + navigation.state.params.username
    }
  }

  componentDidMount() {
    // #stop BackroundGeolocation and remove-listeners when Home Screen is rendered.
    BackgroundGeolocation.stop();
    BackgroundGeolocation.removeListeners();

    // if (!this.state.username) {
    //   this.getUsername().then(this.doGetUsername.bind(this)).catch(() => {
    //     this.onClickEditUsername();
    //   });
    // }

    var next_page = 'StartPage';
    AsyncStorage.getItem('@mmp:next_page', (err, item) => {
      if(item) {
        next_page = item;
      }
    });

    this.timeoutHandle = setTimeout(()=>{
      AsyncStorage.getItem('@mmp:auth_token', (err, item) =>
      {
        console.log('Auth token in async storage is ' + item);
        if(item) {
          this.onClickNavigate(next_page);
        }
        else{
          this.onClickNavigate('LoginScreen');
        }
      });
    }, 3000);
  }

  onClickNavigate(routeName) {
    App.setRootRoute(routeName);
    let action = StackActions.reset({
      index: 0,
      actions: [
        NavigationActions.navigate({routeName: routeName, params: {
          username: this.state.username
        }})
      ],
      key: null
    });
    this.props.navigation.dispatch(action);     
  }

  // onClickEditUsername() {
  //   AsyncStorage.getItem(USERNAME_KEY, (err, username) => {
  //     AsyncStorage.removeItem(USERNAME_KEY);
  //     this.getUsername(username).then(this.doGetUsername.bind(this)).catch(() => {
  //       // Revert to current username on [Cancel]
  //       AsyncStorage.setItem(USERNAME_KEY, username);
  //       this.onClickEditUsername();
  //     });
  //   });
  // }

  onClickViewServer() {
     Linking.canOpenURL(this.state.url).then(supported => {
      if (supported) {
        Linking.openURL(this.state.url);
      } else {
        console.log("Don't know how to open URI: " + this.props.url);
      }
    });
  }

  // getUsername(defaultValue) {
  //   return new Promise((resolve, reject) => {
  //     AsyncStorage.getItem(USERNAME_KEY, (err, username) => {
  //       if (username) {
  //         resolve(username);
  //       } else {
  //         prompt('Tracking Server Username', 'Please enter a unique identifier (eg: Github username) so the plugin can post loctions to tracker.transistorsoft.com/{identifier}', [{
  //           text: 'OK',
  //           onPress: (username) => {
  //             username = username.replace(/\s+/, "");
  //             console.log('OK Pressed, username: ', username, username.length);
  //             if (!username.length) {
  //               Alert.alert('Username required','You must enter a username.  It can be any unique alpha-numeric identifier.', [{
  //                 text: 'OK', onPress: () => {
  //                   reject();
  //                 }
  //               }],{
  //                 cancelable: false
  //               });
  //             } else if (!USERNAME_VALIDATOR.test(username)) {
  //               Alert.alert("Invalid Username", "Username must be alpha-numeric\n('-' and '_' are allowed)", [{
  //                 text: 'OK', onPress: () => {
  //                   reject();
  //                 }
  //               }],{
  //                 cancelable: false
  //               });
  //             } else {
  //               resolve(username);
  //             }
  //           }
  //         }],{
  //           type: 'plain-text',
  //           defaultValue: defaultValue || ''
  //         });
  //       }
  //     });
  //   });
  // }  

  // doGetUsername(username) {
  //   AsyncStorage.setItem(USERNAME_KEY, username);

  //   this.setState({
  //     username: username,
  //     url: TRACKER_HOST + username
  //   });

  //   BackgroundGeolocation.setConfig({url: TRACKER_HOST + 'locations/' + username});
  // }

  render() {
    return (

    <ImageBackground style={styles.container}>
    {/* <ImageBackground source={require('../../images/background-image-for-app.jpg')} style={styles.container}> */}
      <View style={styles.logocontainer}>
          <Image source={require('../../images/MMP.png')} style={styles.logo} />
      </View>

    {/* <ActivityIndicator size="large" color="#ffff00" animating={true} />
    <Text style={{color: 'red', fontWeight: 'bold'}}>
      Loading...
    </Text> */}

    </ImageBackground>
    );
  }
}

const styles = StyleSheet.create({
  container: {
      flex: 1,
      justifyContent: 'center',
      alignSelf: 'stretch',
      width: null,
      padding: 20,
      backgroundColor: 'white',
  },
  horizontal: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      padding: 10
  },
  logocontainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
  },
  logo: {
      flex: 1,
      width: 300,
      height: 150,
      resizeMode: 'contain'
  },
  loginformcontainer: {
      alignItems: 'center',
  },
  textinput: {
      color: '#fff',
      alignSelf: 'stretch',
      padding: 12,
      marginBottom: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderColor: '#fff',
      borderWidth: 0.6,
  },
  switch: {
      padding: 12,
      marginBottom: 30,
      borderColor: '#fff',
      borderWidth: 0.6,
  },
  text: {
      fontSize: 20,
  },
  loginbtn: {
      backgroundColor: '#ecf0f1',
      alignSelf: 'stretch',
      alignItems: 'center',
      padding: 14,
      marginTop: 10,
  },
});