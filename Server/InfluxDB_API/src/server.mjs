import express from 'express';
import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { getEnvs } from './envs.mjs';
const ENV = getEnvs();
const app = express();
console.log(ENV.INFLUX.HOST);
// 1.2 Initialize DB connection
const DB_CLIENT = new InfluxDB({
    url: ENV.INFLUX.HOST,
    token: ENV.INFLUX.TOKEN
});
const DB_WRITE_POINT = DB_CLIENT.getWriteApi(
    ENV.INFLUX.ORG,
    ENV.INFLUX.BUCKET
);
DB_WRITE_POINT.useDefaultTags({ app: 'db_api' });
// Endpoint - embed
app.get('/api/v1/', (_, res) => res.sendStatus(200));
app.get('/api/v1/embed', async (req, res) => {
    try {
        const value = req.query.value;
        const numeric_value = parseFloat(value);
        const point = new Point("qparams");
        point.floatField("value", numeric_value);
        DB_WRITE_POINT.writePoint(point); // starts transaction
        await DB_WRITE_POINT.flush(); // end the transaction => save
        res.send(`Value: '${value}' written.`);
    } catch(err) {
        console.error(err);
        // console.log({ db: ENV.INFLUX.HOST });
        res.sendStatus(500);
    }
});

// Enpoints - base
app.get('', (_, res) => res.send('OK'));

// Enpoints - test query params
app.get('/test', (req, res) => {
    console.log(req.query);
    res.send('received queryparams!');
});

// Enpoints - Fetch data from InfluxDB
app.get('/api/v1/getData', async (req, res) => {
    const query = `
        from(bucket: "${ENV.INFLUX.BUCKET}")
        |> range(start: -30d)
        |> filter(fn: (r) => r._measurement == "qparams")
        |> filter(fn: (r) => r._field == "value")
    `;

    try {
        const data = [];
        const DB_READ_API = DB_CLIENT.getQueryApi(ENV.INFLUX.ORG);

        await DB_READ_API.queryRows(query, {
            next(row, tableMeta) {
                const res = tableMeta.toObject(row);  
                data.push(res);  
            },
            error(error) {
                console.error('Error during query:', error); 
                res.status(500).send('Error fetching data from InfluxDB');
            },
            complete() {
                if (data.length === 0) {
                    res.status(404).send('No data found');  
                } else {
                    res.json(data); 
                }
            },
        });
    } catch (err) {
        console.error('Error in /get-data route:', err);  // Log lỗi nếu có
        res.status(500).send('Error fetching data from InfluxDB');
    }
});


app.listen(ENV.PORT, ENV.HOST, () => {
    console.log(`Listening http://${ENV.HOST}:${ENV.PORT}`);
});

