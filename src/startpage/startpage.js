import React, { Component } from 'react';

import {StyleSheet, Text, View, TextInput, TouchableOpacity, TouchableHighlight, Image, ImageBackground, AsyncStorage, ScrollView, ActivityIndicator} from "react-native";

import LoginForm from '../../components/loginform';

import { NavigationActions, StackActions } from 'react-navigation';

import { 
    Container,
    StyleProvider
    // Header, Footer, Title,
    // Content, 
    // Left, Body, Right,
    // Switch 
  } from 'native-base';

import { Button } from 'react-native-elements';
import Icon from 'react-native-vector-icons/FontAwesome';  
  
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

        AsyncStorage.getItem('mmp_username').then((value) => {this.setState({usernameValue: value.toString().toLowerCase()})});

        onLoginPressButton = () => {
            this.onClickNavigate('SimpleMap');    
        }
        AsyncStorage.setItem("@mmp:next_page", 'StartPage');
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
        <View style={styles.container}>
            {/* <Text style={styles.infotext}>
                You are logged in as
            </Text>
            <Text style={styles.infotextbold}> {this.state.usernameValue}</Text> */}
            <Button
                buttonStyle={{backgroundColor: 'orange', borderRadius: 10, margin: 10}}
                title='Start tracking' onPress={() => this.onClickNavigate('SimpleMap')}
            >
            </ Button>
            <Button
                buttonStyle={{backgroundColor: 'orange', borderRadius: 10, margin: 10}}
                title='Log out' onPress={() => this.onClickNavigate('LoginScreen')}
            >
            </ Button>
        </ View>
    );
  }
}

const styles = StyleSheet.create({
    infotext: {
        color: 'orange'
    },
    infotextbold: {
        color: 'orange',
        fontWeight: 'bold'
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignSelf: 'stretch',
        width: null,
        padding: 20,
        margin: '20%'
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
        alignItems: 'center',
        padding: 14,
        marginTop: 10,
    },
    icon: {
        color: '#fff'
    }
});