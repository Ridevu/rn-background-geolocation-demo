/**
 * Background Geolocation Demo App.
 * Transistor Software.
 */

import React, { Component } from 'react';
import {
  View,
  AsyncStorage,
  StatusBar
} from 'react-native';

import { NavigationActions, StackActions } from 'react-navigation';

import {StyleProvider} from "native-base";
import Navigator from './Navigator';

export default class App extends Component<{}> {
  /**
  * Helper method for resetting the router to Home screen
  */
  static goHome(navigation) {
    AsyncStorage.setItem("@transistorsoft:initialRouteName", 'LoginScreen');
    let action = StackActions.reset({
      index: 0,
      actions: [
        NavigationActions.navigate({ routeName: 'LoginScreen', params: navigation.state.params})
      ],
      key: null
    });
    navigation.dispatch(action);    
  }

  static setRootRoute(routeName) {
    AsyncStorage.setItem("@transistorsoft:initialRouteName", routeName);
  }

  render() {
    return (
<View style={{flex: 1}}>
   <StatusBar
     backgroundColor="darkorange"
     barStyle="light-content"
   />
   <Navigator
     initialRoute={{statusBarHidden: true}}
     renderScene={(route, navigator) =>
       <View>
         <StatusBar hidden={route.statusBarHidden} />
       </View>
     }
   />
 </View>
     );
  }
}
