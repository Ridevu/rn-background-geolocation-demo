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
            token: '',
            jobList: [],
            jobListLoaded: false
        }

        AsyncStorage.getItem('mmp_username').then((value) => {this.setState({usernameValue: value.toString().toLowerCase()})});

        onLoginPressButton = () => {
            this.onClickNavigate('SimpleMap');    
        }
        AsyncStorage.setItem("@mmp:next_page", 'StartPage');
    }

    parseJobId(jobIdText) {
        if(this.state.jobIdText != null && this.state.jobIdText.length > 0)
            return parseInt(this.state.jobIdText.replace(/[^0-9]/g, ''));
        else
            return 0;
    }

    async onClickGoToJob(jobId) {
        // console.log("TODAY - jobId = " + jobId.toString())
        await AsyncStorage.setItem("@mmp:job_id", jobId.toString());
        this.onClickNavigate('SimpleMap');
    }

    async onClickGoToEmptyMap() {
        try {
            await AsyncStorage.setItem("@mmp:job_id", "0");
            this.onClickNavigate('SimpleMap');
        }
        catch(exception) {
        }        
        this.onClickNavigate('SimpleMap');
    }

    onClickNavigate(routeName) {
        navigateAction = NavigationActions.navigate({
            routeName: routeName,
            params: { username: this.state.username },
        });
        this.props.navigation.dispatch(navigateAction);        
    }

    async LoadJobs() {
        var auth_token = "";
        var user_id = "";
        await AsyncStorage.getItem('@mmp:auth_token', (err, item) => auth_token = item);
        await AsyncStorage.getItem('@mmp:user_id', (err, item) => user_id = item);
            
        fetch('https://managemyapi.azurewebsites.net/Mobile.asmx/GetJobs', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json; charset=utf-8;',
              'Data-Type': 'json'
            },
            body: JSON.stringify({
              token: auth_token,
              user_id: user_id,
              job_status: 0,
              get_job_detail: 0
            }),
        })
        .then((response) => response.json())
        .then((responseJson) => {
            var eligibleJobs = [];
            for(var i = 0; i < responseJson.d.length; i++)
                if(responseJson.d[i].job_status !== 3)
                    eligibleJobs.push(responseJson.d[i]);
            this.setState({jobList: eligibleJobs});
        })
        .catch((error) =>{
            console.log("Error loading jobs");
            console.error(error);
        });
    }

render() {
    return (
        <ImageBackground style={styles.container}>

            <ScrollView style={styles.scrollview}>
    
                <Button
                    buttonStyle={{backgroundColor: 'orange', borderRadius: 10, margin: 10}}
                    title='Select a job from list' onPress={this.LoadJobs.bind(this)} disabled={this.state.jobList.length !== 0}
                >
                </ Button>
            
                {this.state.jobList.map((job) => (
                    <Button
                    key={job.job_id}
                    buttonStyle={{backgroundColor: 'orange', borderRadius: 10, margin: 10}}
                    title={"Load job #" + job.job_id.toString()} onPress={() => this.onClickGoToJob(job.job_id)}
                    >
                    </ Button>))
                }
    
                <View style={{flexDirection:"row"}}>
                    <View style={{flex:1}}>
                        <TextInput 
                        style={styles.textinput}
                        keyboardType='numeric'
                        multiline={false}
                        underlineColorAndroid="transparent"
                        onChangeText={(text) => this.setState({jobIdText: text})}
                        value={this.state.jobIdText}
                                        
                        // onChangeText = {(text)=> this.onJobIdChanged(text)}
                        placeholder = 'Enter a job ID'
                        /> 
                    </View>
                    <View style={{flex:1}}>
                        <Button
                        key={0}
                        buttonStyle={{backgroundColor: 'orange', borderRadius: 10, margin: 10}}
                        title={"Load"} onPress={() => this.onClickGoToJob(this.parseJobId(this.state.jobIdText))}
                        >
                        </ Button>
                    </View>
                </View>

                <Button
                    buttonStyle={{backgroundColor: 'orange', borderRadius: 10, margin: 10}}
                    title='Load empty map' onPress={() => this.onClickGoToEmptyMap()}
                >
                </ Button>
                <Button
                    buttonStyle={{backgroundColor: 'red', borderRadius: 10, margin: 10}}
                    title='Log out' onPress={() => this.onClickNavigate('LoginScreen')}
                >
                </ Button>

            </ScrollView>
        </ ImageBackground>
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
        padding: 10,
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
    scrollview: {
        paddingVertical: 10
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