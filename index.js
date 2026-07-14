const express = require('express');
const cors = require('cors');
require('dotenv').config();
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
var admin = require("firebase-admin");
const port = process.env.PORT || 3000;


// Initialize Firebase Admin
// index.js
const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Middleware
app.use(cors());
app.use(express.json());

// FIXED: Added missing closing bracket
const logger = (req, res, next) => {
    console.log('logging info');
    next();
};

// Firebase Token Verification Middleware
const veriFireBaseToken = async (req, res, next) => {
    console.log('in the verify', req.headers.authorization);
    if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized token' });
    }

    const token = req.headers.authorization.split(' ')[ 1 ];
    if (!token) {
        return res.status(401).send({ message: 'unauthorized token' });
    }

    try {
        const decoded = await admin.auth().verifyIdToken(token);  // firebse diya token ke verifiyd kora
        console.log('after token validation', decoded);
        req.token_email = decoded.email
        next();
    } catch (error) {
        // FIXED: Added logging target
        console.error("invalid token:", error);
        return res.status(401).send({ message: 'unauthorized token' });
    }
};


// MongoDB connection URI
const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-tnfghrx-shard-00-00.i4vs1nh.mongodb.net:27017,ac-tnfghrx-shard-00-01.i4vs1nh.mongodb.net:27017,ac-tnfghrx-shard-00-02.i4vs1nh.mongodb.net:27017/smart_db?ssl=true&replicaSet=atlas-pgcyip-shard-0&authSource=admin&appName=Cluster0`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


// veriryJDT Token 
const veryfyJWTToken = (req, res, next) => {
    console.log('in middleware', req.headers);
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ message: 'unAuthorize' })
    }
    const token = authorization.split(' ')[ 1 ];
    if (!token) {
        return res.status(401).send({ message: 'unAuthorize' });
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unAuthorizes' })
        }
        console.log('after Decoded:', decoded);
        req.token_email = decoded.email;
        // console.log('token email' ,req.token_email)
        next();
    })
}




app.get('/', (req, res) => {
    res.send('smart server is running on');
});


async function run() {
    try {
        await client.connect();

        const db = client.db('smart_db');
        const productCollection = db.collection('products');
        const bidsCollections = db.collection('bids');
        const userCollection = db.collection('users');



        // jwt related api
        // jwt related api
        app.post("/getToken", (req, res) => {
            const loggedUser = req.body;
            console.log("Received:", loggedUser);
            const token = jwt.sign(loggedUser, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.json({ token: token });   // ← সবচেয়ে গুরুত্বপূর্ণ
        });



        // User insertion route /
        app.post('/users', async (req, res) => {
            const newuser = req.body;
            const email = newuser.email;
            const query = { email: email };
            const existingUser = await userCollection.findOne(query);

            if (existingUser) {
                res.send({ message: 'user already exist, do not need insert again' });
            } else {
                const result = await userCollection.insertOne(newuser);
                res.send(result);
            }
        });

        // Insert product /
        app.post('/products', veriFireBaseToken, async (req, res) => {
            console.log('headers in the post', req.headers)
            const neProduct = req.body;
            const result = await productCollection.insertOne(neProduct);
            res.send(result);
        });

        // Get products (with optional email query) /
        app.get('/products', async (req, res) => {
            console.log(req.query.email);
            const email = req.query.email;
            const query = {};
            if (email) {
                query.email = email;
            }

            const cursor = productCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        // Get latest products /
        app.get('/latest-products', async (req, res) => {
            const cursor = productCollection.find().sort({ created_at: -1 }).limit(6);
            const result = await cursor.toArray();
            res.send(result);
        });

        // Get single product /
        app.get('/products/:id', async (req, res) => {
            console.log("Route hit");
            const id = req.params.id;
            console.log(req.params.id);
            const query = { _id: new ObjectId(id) }
            const result = await productCollection.findOne(query);
            console.log(result);
            res.send(result);
        });

        // Update product /
        app.patch('/products/:id', async (req, res) => {
            const id = req.params.id;
            const updatedProduct = req.body;
            const query = { _id: new ObjectId(id) };
            const update = {
                $set: {
                    name: updatedProduct.name,
                    price: updatedProduct.price
                }
            };
            const result = await productCollection.updateOne(query, update);
            res.send(result);
        });

        // Delete product /
        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await productCollection.deleteOne(query);
            res.send(result);
        });

        // 
        //
        app.get("/bids", veriFireBaseToken, async (req, res) => {
            console.log('headers', req.headers)

            const email = req.query.email;
            const query = {};
            if (email) {
                query.buyer_email = email;
                if (email !== req.token_email) {
                    return res.status(401).send({ message: 'unauthorize' })
                }
            }

            const cursor = bidsCollections.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })

        // // Get user bids /
        // app.get('/bids', logger, veriFireBaseToken, async (req, res) => {
        //     const email = req.query.email;
        //     const query = {};
        //     if (email) {
        //         query.buyer_email = email;
        //     }
        //     const cursor = bidsCollections.find(query);
        //     const result = await cursor.toArray();
        //     res.send(result);
        // });


        // Post a bid /
        app.post('/bids', async (req, res) => {
            const newBid = req.body;
            const result = await bidsCollections.insertOne(newBid);
            res.send(result);
        });

        // Get bids for a specific product /
        app.get('/products/bids/:productId', async (req, res) => {
            const productId = req.params.productId;
            const query = { product: productId };
            const cursor = bidsCollections.find(query).sort({ bid_price: -1 });
            const result = await cursor.toArray();
            res.send(result);
        });


        // Delete a bid
        app.delete('/bids/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bidsCollections.deleteOne(query);
            res.send(result);
        });

        // Ping MongoDB deployment
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Keeps connection open for express app
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`smart server is running on port ${port}`);
});