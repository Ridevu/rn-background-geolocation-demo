/**
* This is the Application's root navigator which automatically routes to the currently
* selected example app.
* - HelloWorld
* - SimpleMap
* - Advanced
*
* The default route is home/Home
*
* This file contains nothing related to Background Geolocation plugin.  This is just
* boilerplate routing stuff.
*/
import React, { Component } from 'react';
import {
  AsyncStorage,
  View,
  Text,
  StyleSheet
} from 'react-native';

import { createStackNavigator, StackActions, NavigationActions } from 'react-navigation';

import Home from './home/Home';
import HelloWorld from './hello-world/HelloWorld';
import SimpleMap from './simple-map/SimpleMap';
import AdvancedApp from './advanced/AdvancedApp';
import LoginScreen from './loginscreen/loginscreen';
import StartPage from './startpage/StartPage';

class Root extends Component<{}> {  
  componentDidMount() {
    let navigation = this.props.navigation;

    // Fetch current routeName (ie: HelloWorld, SimpleMap, Advanced)
    AsyncStorage.getItem("@transistorsoft:initialRouteName", (err, page) => {
      let params = {username: undefined};
      if (!page) {
        // Default route:  Home
        page = "Home";
        // AsyncStorage.setItem("@transistorsoft:initialRouteName", page);
        AsyncStorage.setItem("@transistorsoft:initialRouteName", "Home");
      }

      AsyncStorage.getItem('@mmp:next_page', (err, item) => {
        if (!item) {
          AsyncStorage.setItem("@mmp:next_page", "StartPage");
        }
      });

      // Append username to route params.
      page = "Home";
      AsyncStorage.getItem("@transistorsoft:username", (err, username) => {
        // Append username to route-params
        if (username) { params.username = username; }
        let action = StackActions.reset({
          index: 0,
          actions: [
            NavigationActions.navigate({ routeName: page, params: params})
          ],
          key: null
        });
        navigation.dispatch(action);
      });
    });
  }
  render() {
    return (<View></View>);
  }
}

export default Navigator = createStackNavigator({
  Root: {
    screen: Root,
  },
  Home: {
    screen: Home
  },
  HelloWorld: {
    screen: HelloWorld
  },
  SimpleMap: {
    screen: SimpleMap
  },
  Advanced: {
    screen: AdvancedApp
  },
  LoginScreen: {
    screen: LoginScreen
  },
  StartPage: {
    screen: StartPage
  }
}, {
  initialRouteName: 'Root',
  headerMode: 'none',
  onTransitionStart: (transition) => {
    let routeName = transition.scene.route.routeName;
  }
});
