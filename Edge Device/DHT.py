from machine import Pin
from dht import DHT11
from utime import sleep
import time
from network import WLAN
import network
import urequests as requests

# Initial values
# Initialize DHT11 Sensor
dhtPin = 0
dht = DHT11(Pin(dhtPin, Pin.IN))
LED = Pin("LED",Pin.OUT)

INTERVAL = 20 # 20 seconds for cloud

# Wifi Details
WF_SSID = "DN.Matthias" 
WF_PASS = "idontknow"

# REST API Details
BASE_URL = "http://68.219.251.214/db_api/api/v1/" 
DATA_ENDPOINT = "/embed" 
DEBUG = True

def log(data)->None:
    if DEBUG:
        print(repr(data))
    return None

def sendData(endpoint: str, humidity: int)->None:
    url = f"{BASE_URL}/{endpoint}?value={humidity}"
    try:
        log("Sending request to {url}")
        res = requests.get(url)
        log(f"Response status: {res.status_code}")
        log(f"Response message: {res.text}")
    except Exception as error:
        print("Error:",error)
    

def connectWifi()->WLAN:
    wlan = network.WLAN(network.STA_IF)
    print("Connecting", end="")
    wlan.active(True)
    wlan.connect(WF_SSID,WF_PASS)
    while not wlan.isconnected():
        print("\n...",end="")
        time.sleep(0.1)
    print("\nConnected!")
    log(wlan.ifconfig())
    return wlan

def main()->None:
    print("Program starting.")
    wlan = connectWifi()
    
    while True:
        dht.measure()
        humid = dht.humidity()  
        print('Humidity:', humid, '%')
        LED.on()
        sendData(DATA_ENDPOINT,humid)
        time.sleep(0.2) 
        LED.off()
        time.sleep(INTERVAL) 


main()