//Settings
const admin = require('firebase-admin');
const express = require('express');
const morgan = require('morgan');

const app = express();
app.use(morgan('dev'));
app.listen(3000);
console.log("Server on port", 3000);

var serviceAccount = require('./juegojai-firebase-adminsdk-rerk4-a4774b8f18.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://juegojai.firebaseio.com'
});

const db = admin.database();

const { Router }= require('express');
const router = Router();

// 1. añadir trofeos ganados en cada usuario
//  1.1. ordenar usuario segun trofeos dentro de los grupos
//  1.2. segun pos añadir trofeos a c/u de los usuarios
// 2. borrar score groups
// 3. crear nuevos grupos segun percentil
//  3.1. cant de usuarios / cant de nivel = (int) cant de personas por nivel / cant personas x grupo = cant grupos
//  3.2. ordenar usuarios segun trofeos 0, si empate trofeos 1, si empate trofeos 2
//  3.3. ir creando grupos con usuario

const numberOfLevels = 5;
const numberOfUserPerGroup = 8;

router.post('/refresh-ranking', async (req, res) => {
    console.log("hola");
    //punto 1.
    //await addUserTrophies();
    console.log("como");
    //punto 2.
    deleteOldScoreGroups();
    console.log("estas");
    //punto 3.
    await createNewGroups();
    console.log("bien");

    res.status(200).send('Ok');
});

//aux functions from section 1.
async function addUserTrophies(){
    let result= new Promise(async (resolve, reject) => {
        await db.ref('group-scores').once('value', async (scoreGroups) => {
            let sG = Object.keys(scoreGroups.val());
            console.log(sG);
            await Promise.all(sG.map(async (group)=> {
                console.log("The " + group + " dinosaur's score is " + JSON.stringify(scoreGroups.val()[group]));
                let topUsers = sortGroup(scoreGroups.val()[group]);
                await addTropies(topUsers);
                return true;
            }));
            resolve();
        });
    });
    return result;
     //console.log("holaaaaaaaaaaaa",JSON.stringify(topUsers))
     //await topUsers.forEach(async function(topUser) {await addTropies(topUser)});
}

function sortGroup(group){
    let sortable=[];

    for (user in group) sortable.push([user, group[user]]);
    console.log("SORTABLE \n",sortable);
    sortable.sort((a, b) => b[1] - a[1]);

    return sortable;
}

async function addTropies(topUsers){
    console.log("Top Users: ",topUsers);
    let t0,t1,t2;
    const ref = await db.ref("users");
    try{
        await ref.child(`${topUsers[0][0]}/trophy0`).once('value', async (trophy) => t0 = await trophy.val() + 1);
        await ref.child(`${topUsers[1][0]}/trophy1`).once('value', async (trophy) => t1 = await trophy.val() + 1 );
        await ref.child(`${topUsers[2][0]}/trophy2`).once('value', async (trophy) => t2 = await trophy.val() + 1 );
    }catch{
        return true;
    }
    console.log("Trophy0: ",t0," Trophy1: ",t1," Trophy2: ",t2);

    await ref.child(`${topUsers[0][0]}`).update({'trophy0': t0});
    await ref.child(`${topUsers[1][0]}`).update({'trophy1': t1});
    await ref.child(`${topUsers[2][0]}`).update({'trophy2': t2});

}

//aux functions from section 2.
function deleteOldScoreGroups(){
    db.ref().child("group-scores").remove();
}

//aux functions from section 3.
async function createNewGroups(){
    let users=[];
    await db.ref().child("users").orderByChild("trophy0").once('value', async (orderUsers) =>{
        orderUsers.forEach(function(child) {
            if (child.key != null && child.val().trophy0 != null) users.push([child.key, child.val().trophy0])
        });
    });
    //users = users.map(u=> users.toString().split(","));
    console.log(JSON.stringify(users));
    let groups = createGroups(users);
    let lastGroup, newPostRef;
    for await  (group of groups) {
        newPostRef = await db.ref("group-scores").push(group);
        if (group["level"] == 0) lastGroup = newPostRef.key;
    } 
    await db.ref().update({"last-group": lastGroup}); 
}

function createGroups(usuarios){
    //obtener todos los usuarios ordenados segun su trofeo 0
    const groupPerLevel = parseInt(usuarios.length / numberOfLevels / numberOfUserPerGroup/ 8) < 1 ? 1: 0;
    console.log("cantidad de grupos por nivel ",usuarios.length);
    let userAssigned = 0;
    let groups = [];
    for (let i=0; i<numberOfLevels; i++){
        for (let k=0; k<groupPerLevel; k++){
            let group = {};
            for (let j=0; j<numberOfUserPerGroup; j++){
                if (usuarios[userAssigned] != null){
                    group[usuarios[userAssigned][0]] = 0;
                    userAssigned++;
                }
            }
            group["level"] = i;
            groups.push(group);
        }
    }
    console.log("los grupos son", groups);
    return groups;
}

app.use(router);