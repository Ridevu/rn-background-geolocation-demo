import React, { Component } from 'react';

import {StyleSheet, Text, View, TextInput, TouchableOpacity, Image, ImageBackground, AsyncStorage} from "react-native";

import LoginForm from '../../components/loginform';


import { StackNavigator, NavigationActions } from 'react-navigation';

import {StyleProvider} from "native-base";
import Navigator from '../Navigator';


export default class LoginScreen extends Component {
    constructor(props) {
        super(props);
        let navigation = props.navigation;
        this.state = {
            usernameValue: '',
            passwordValue: '',
            token: '',
        }

        AsyncStorage.getItem('mmp_username').then((value) => {this.setState({usernameValue: value})});
        AsyncStorage.getItem('mmp_password').then((value) => {this.setState({passwordValue: value})});
        changeUsername = (text) => {
            this.state.usernameValue = text;
            console.log('Username is: ' + text);
            console.log('And in state - ' + this.state.usernameValue);
        }
        changePassword = (text) => {
            this.state.passwordValue = text;
            console.log('Password is: ' + text);
            console.log('And in state - ' + this.state.passwordValue);
        }
        onLoginPressButton = () => {
            console.log('State is: ' + JSON.stringify(this.state));

            fetch('https://managemyapi.azurewebsites.net/Mobile.asmx/AuthRequest', {
                method: 'POST',
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'application/json; charset=utf-8;',
                  'Data-Type': 'json'
                },
                body: JSON.stringify({
                  username: this.state.usernameValue,
                  password: this.state.passwordValue,
                  device_id: 1024
                }),
            })
            .then((response) => response.json())
            .then((responseJson) => {
                // this.setState({authToken: responseJson.d.token});
                if(responseJson.d.auth_result == 0) {
                    AsyncStorage.setItem('mmp_auth_token', responseJson.d.token);
                    console.log("Auth token is " + responseJson.d.token);
                    AsyncStorage.setItem('mmp_user_id', responseJson.d.user.user_id.toString());
                    AsyncStorage.setItem('mmp_username', this.state.usernameValue);
                    AsyncStorage.setItem('mmp_password', this.state.passwordValue);
                    this.onClickNavigate('SimpleMap');    
                }
            })
            .catch((error) =>{
                console.error(error);
            });
        }        
    }
    onClickNavigate(routeName) {
        this.props.navigation.dispatch(NavigationActions.reset({
          index: 0,
          key: null,
          actions: [
            NavigationActions.navigate({routeName: routeName, params: {
              username: this.state.username
            }})
          ]
        }));
    }
        
render() {
    return (
        <ImageBackground source={require('../../images/background-image-for-app.jpg')} style={styles.container}>
            <View style={styles.logocontainer}>
                <Image source={require('../../images/logo-image-for-app.png')} style={styles.logo} />
            </View>

            <View style={styles.loginformcontainer}>
                <TextInput underlineColorAndroid='transparent' defaultValue={this.state.usernameValue} placeholder='Username' style={styles.textinput} onChangeText={changeUsername} />
                <TextInput underlineColorAndroid='transparent' defaultValue={this.state.passwordValue} placeholder='Password' secureTextEntry={true} style={styles.textinput}  onChangeText={changePassword} />
                <TouchableOpacity style={styles.loginbtn} onPress={onLoginPressButton}>
                    <Text>Login</Text>
                </ TouchableOpacity>
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
    logocontainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logo: {
        width: 140,
        height: 140,
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