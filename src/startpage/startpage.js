import React, { Component } from 'react';

import {StyleSheet, Text, View, TextInput, TouchableOpacity, Image, ImageBackground, AsyncStorage, ScrollView, ActivityIndicator} from "react-native";

import LoginForm from '../../components/loginform';

import { NavigationActions, StackActions } from 'react-navigation';

import {StyleProvider} from "native-base";
import Navigator from '../Navigator';

import App from '../App';

export default class StartPage extends Component {
    constructor(props) {
        super(props);
        let navigation = props.navigation;
        this.state = {
            usernameValue: '',
            passwordValue: '',
            token: ''
        }

        AsyncStorage.getItem('mmp_username').then((value) => {this.setState({usernameValue: value})});


        onLoginPressButton = () => {
            this.onClickNavigate('SimpleMap');    
        }        
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
    
        
render() {
    return (
        <ImageBackground style={styles.container}>
        {/* <ImageBackground source={require('../../images/background-image-for-app.jpg')} style={styles.container}> */}

            <View scrollEnabled={false} style={styles.loginformcontainer}>
                <TouchableOpacity style={styles.loginbtn} onPress={onLoginPressButton}>
                    {/* <Text>Login</Text> */}
                    <Icon active name="md-play" style={styles.icon} onPress={this.onClickResetMarkers.bind(this)} />
                </ TouchableOpacity>
                <Text style={{color: 'red', fontWeight: 'bold'}}>
                    Start tracking as {this.state.usernameValue}
                </Text>
            </View>
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
        width: 400,
        height: 200,
        resizeMode: 'contain'
        //         width: 500,
        // height: 140,
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