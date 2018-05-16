import React, { Component } from 'react';

import {StyleSheet, Text, View, TextInput, TouchableOpacity, AsyncStorage} from "react-native";

import { StackNavigator, NavigationActions } from 'react-navigation';

import {StyleProvider} from "native-base";
import Navigator from '../src/Navigator';

export default class LoginForm extends Component {
    constructor() {
        super();
        this.state = {
            usernameValue: '',
            passwordValue: '',
            tomen: '',
        }
        console.log('REMEMBER ME is switched ON!!! Loading values from AsyncStorage...');
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
                this.setState({authToken: responseJson.d.token});
                AsyncStorage.setItem('mmp_auth_token', this.state.authToken);
                console.log('Authenticated, token is:' + responseJson.d.token);                
                AsyncStorage.setItem('mmp_username', this.state.usernameValue);
                AsyncStorage.setItem('mmp_password', this.state.passwordValue);

                NavigationActions.reset({
                    index: 0,
                    key: null,
                    actions: [
                      NavigationActions.navigate({ routeName: 'JobSelectionScreen', params: {}})
                    ]
                })
            })
            .catch((error) =>{
                console.error(error);
            });
        }
   }
render() {
    return (
      <View style={styles.loginformcontainer}>
        <TextInput underlineColorAndroid='transparent' defaultValue={this.state.usernameValue} placeholder='Username' style={styles.textinput} onChangeText={changeUsername} />
        <TextInput underlineColorAndroid='transparent' defaultValue={this.state.passwordValue} placeholder='Password' secureTextEntry={true} style={styles.textinput}  onChangeText={changePassword} />
        <TouchableOpacity style={styles.loginbtn} onPress={onLoginPressButton}>
            <Text>Login</Text>
        </ TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
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