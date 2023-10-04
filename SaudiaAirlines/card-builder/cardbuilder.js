const { createCanvas, loadImage, registerFont } = require('canvas')
const fs = require('fs');
registerFont('./card-builder/fonts/SaudiaSans-Regular.ttf', { family: 'SaudiaSans-Regular' })
registerFont('./card-builder/fonts/SaudiaSans-Bold.ttf', { family: 'SaudiaSans-Bold' })

let cfg = {
    heights:{
        headerLogoPNR: 146,
        flightDetailsHeader: 54,
        flightDetailsText: 32,
        plusOneDay: 48,
        airportNameLine: 20,
        airportCode: 64,
        layover: 128,
        passengerSeatsHeader: 72,
        passenger: 56,
        footer: 32,
        pnr: 32,
        depDateStr: 8,
        layoverText: 20,
        passengerName: 16
    },
    padding: {
        vertical: 24,
        horizontal: 32,
        flightPlane: 16,
        airportNameLine: 8,
        pnr: 72,
        plusOneDay: 6,
        layoverText: 48
    },
    width: 687,
    fontSize: {
        "20": '20px SaudiaSans-Regular',
        "28": '28px SaudiaSans-Regular',
        "28-bold": '28px SaudiaSans-Bold',
        "32": '32px SaudiaSans-Regular',
        "32-bold": '32px SaudiaSans-Bold',
        "64": '64px SaudiaSans-Bold',
    },
    color: {
        white: '#FFFFFF',
        black: '#000000',
        lightGray: '#0000008C',
        darkGray: '#000000B2',
        red: '#BB3225'
    }
}

async function buildCard(data, dictionaries){
    //Build stack
    let cardStack = buildCardStack(data);
    // console.log(cardStack);
    //Calculate height
    let calculatedHeight = calculateHeight(cardStack, dictionaries);
    // console.log(calculatedHeight);
    //Create canvas
    //Process stack
    //For each stack item -> draw
    let imgURI = await drawCard(cardStack, calculatedHeight, dictionaries);

    return imgURI;
}

function buildCardStack(data){
    let cardStack = [];

    //Push header
    cardStack.push({
        "type": "headerLogoPNR",
        "pnr": data.id
    });
    //Push flights & layovers
    data.air.bounds.forEach(bound => {
        bound.flights.forEach(flight => {
            cardStack.push({
                "type": "flight",
                "flightID": flight.id
            });

            if(flight.connectionTime){
                cardStack.push({
                    "type": "layover",
                    "duration": flight.connectionTime
                })
            }
        })
    });
    //Push passengers header
    cardStack.push({
        "type": "passengerSeatsHeader"
    })
    //Push passengers
    data.travelers.forEach(traveler => {
        traveler.names.forEach(name => {
            cardStack.push({
                "type": "passenger",
                "name": name.firstName + " " + name.lastName
            })
        })
    })
    //Push footer
    cardStack.push({
        "type": "footer"
    })

    return cardStack;
}

function calculateHeight(cardStack, dictionaries) {
    let height = 0;

    let cvWidth_calc = cfg.width;
    let cvHeight_calc = 1200;

    const canvas = createCanvas(cvWidth_calc, cvHeight_calc);
    const ctx = canvas.getContext('2d');

    cardStack.forEach(item => {
        switch (item.type) {
            case "headerLogoPNR":
                height += cfg.heights.headerLogoPNR;
                break;
            case "flight":
                height += getFlightHeight(item, ctx, dictionaries);
                break;
            case "layover":
                height += cfg.heights.layover;
                break;
            case "passengerSeatsHeader":
                height += cfg.heights.passengerSeatsHeader;
                break;
            case "passenger":
                height += cfg.heights.passenger;
                break;
            case "footer":
                height += cfg.heights.footer;
                break;
            default:
                console.log(item.type, " not configured in height calculator")
                break;
        }
    });

    return height;
}

async function drawCard(cardStack, calculatedHeight, dictionaries) {
    const canvas = createCanvas(cfg.width, calculatedHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = cfg.color.white;
    ctx.fillRect(0,0, cfg.width, calculatedHeight);

    //Load Images
    let headerLogoPNR_img = await loadImage('./card-builder/img/headerLogoPNR.png');
    let flightPlane_img = await loadImage('./card-builder/img/flightPlane.png');
    let flightDetails_img = await loadImage('./card-builder/img/flightDetails.png');
    let plusOneDay_img = await loadImage('./card-builder/img/plusOneDay.png');
    let layoverBlock_img = await loadImage('./card-builder/img/layoverBlock.png');
    let passengerSeatsHeader_img = await loadImage('./card-builder/img/passengersSeatsHeader.png');
    let footer_img = await loadImage('./card-builder/img/footer.png');

    let currentHeight = 0;
    for (let i = 0; i < cardStack.length; i++) {
        const item = cardStack[i];

        switch (item.type) {
            case "headerLogoPNR":
                ctx.drawImage(headerLogoPNR_img, 0, currentHeight);

                ctx.fillStyle = cfg.color.black;
                ctx.font = cfg.fontSize['32-bold'];

                const pnr_width = ctx.measureText(item.pnr).width

                ctx.fillText(item.pnr, cfg.width - pnr_width - cfg.padding.horizontal, currentHeight + cfg.padding.pnr + cfg.heights.pnr);

                currentHeight += headerLogoPNR_img.height;
                break;
            case "flight":
                //Build background
                let flightBoxHeight = getFlightHeight(item, ctx, dictionaries);
                ctx.fillStyle = cfg.color.white;
                ctx.fillRect(0,currentHeight, cfg.width, flightBoxHeight);
                
                let blockHeight = 0
                //Add plane image
                ctx.drawImage(flightPlane_img, cfg.width/2 - flightPlane_img.width/2, currentHeight + cfg.padding.vertical + cfg.padding.flightPlane);

                //Add airport codes
                ctx.fillStyle = cfg.color.black;
                ctx.font = cfg.fontSize[64];
                let flightDetails = getFlightDetails(item.flightID, dictionaries);
                const arrIATA_width = ctx.measureText(flightDetails.arrIATA).width
                ctx.fillText(flightDetails.depIATA, cfg.padding.horizontal, currentHeight + cfg.padding.vertical + cfg.heights.airportCode)
                ctx.fillText(flightDetails.arrIATA, cfg.width - arrIATA_width - cfg.padding.horizontal, currentHeight + cfg.padding.vertical + cfg.heights.airportCode)

                blockHeight += cfg.padding.vertical + cfg.heights.airportCode
                //Add departure date
                ctx.fillStyle = cfg.color.lightGray;
                ctx.font = cfg.fontSize[20];

                const depDateStr_width = ctx.measureText(flightDetails.depDateStr).width;
                ctx.fillText(flightDetails.depDateStr, cfg.width / 2 - depDateStr_width / 2, currentHeight + cfg.padding.vertical + cfg.heights.depDateStr);

                
                //Add airport names
                let arrAirportLines = getLines(ctx, flightDetails.arrAirportName, cfg.width/2 - cfg.padding.horizontal);
                let depAirportLines = getLines(ctx, flightDetails.depAirportName, cfg.width/2 - cfg.padding.horizontal);

                // debugRect(ctx, 0, currentHeight + blockHeight + depAirportHeight + cfg.heights.airportNameLine);

                let depAirportHeight = cfg.padding.airportNameLine;
                depAirportLines.forEach(line => {
                    ctx.fillText(line, cfg.padding.horizontal, currentHeight + blockHeight + depAirportHeight + cfg.heights.airportNameLine);

                    depAirportHeight += cfg.heights.airportNameLine + cfg.padding.airportNameLine;
                });

                let arrAirportHeight = cfg.padding.airportNameLine;
                arrAirportLines.forEach(line => {
                    const line_width = ctx.measureText(line).width
                    ctx.fillText(line, cfg.width - cfg.padding.horizontal - line_width, currentHeight + blockHeight + arrAirportHeight + cfg.heights.airportNameLine)

                    arrAirportHeight += cfg.heights.airportNameLine + cfg.padding.airportNameLine;
                });

                blockHeight += Math.max(arrAirportHeight, depAirportHeight);

                //Add flight details header
                ctx.drawImage(flightDetails_img, 0, currentHeight + blockHeight);
                blockHeight += flightDetails_img.height;
                //Add flight details
                ctx.fillStyle = cfg.color.black;
                ctx.font = cfg.fontSize['32-bold'];

                ctx.fillText(flightDetails.flightNum, cfg.padding.horizontal, currentHeight + blockHeight + cfg.heights.flightDetailsText);


                ctx.fillStyle = cfg.color.red;
                ctx.font = cfg.fontSize['32-bold'];

                const arrTime_width = ctx.measureText(flightDetails.arrTime).width
                const depTime_width = ctx.measureText(flightDetails.depTime).width
                ctx.fillText(flightDetails.depTime, cfg.width/2 - depTime_width/2, currentHeight + blockHeight + cfg.heights.flightDetailsText)
                ctx.fillText(flightDetails.arrTime, cfg.width - arrTime_width - cfg.padding.horizontal, currentHeight + blockHeight + cfg.heights.flightDetailsText);

                blockHeight += cfg.heights.flightDetailsText;
                //Add plus one day
                if(flightDetails.plusOneDay){
                    ctx.drawImage(plusOneDay_img, cfg.width - plusOneDay_img.width - cfg.padding.horizontal, currentHeight + blockHeight + cfg.padding.plusOneDay);
                    blockHeight += plusOneDay_img.height + cfg.padding.plusOneDay;
                }

                currentHeight += flightBoxHeight

                break;
            case "layover":
                ctx.drawImage(layoverBlock_img, 0, currentHeight)

                let layoverText = getLayoverText(item.duration);
                ctx.fillStyle = cfg.color.darkGray;
                ctx.font = cfg.fontSize["28-bold"];

                ctx.fillText(layoverText, cfg.width/2 + cfg.padding.layoverText, currentHeight + layoverBlock_img.height/2 + cfg.heights.layoverText/2);
                
                currentHeight += layoverBlock_img.height;
                break;
            case "passengerSeatsHeader":
                ctx.drawImage(passengerSeatsHeader_img, 0, currentHeight)
                currentHeight += passengerSeatsHeader_img.height;
                break;
            case "passenger":
                ctx.fillStyle = cfg.color.white;
                ctx.fillRect(0,currentHeight, cfg.width, cfg.heights.passenger);
                ctx.font = cfg.fontSize[32];
                ctx.fillStyle = cfg.color.black;
                ctx.fillText(item.name, cfg.padding.horizontal, currentHeight + cfg.heights.passenger/2 + cfg.heights.passengerName/2)
                currentHeight += cfg.heights.passenger;
                break;
            case "footer":
                ctx.drawImage(footer_img, 0, currentHeight)
                currentHeight += cfg.heights.footer;
                break;
            default:
                console.log(item.type, " not configured in height calculator")
                break;
        }
    }
    return imageData = canvas.toDataURL('image/jpeg');
}

function getFlightHeight(item, ctx, dictionaries){
    let height = 0;

    height += cfg.padding.vertical;
    height += cfg.heights.airportCode;
    height += cfg.padding.airportNameLine;

    let flightDetails = getFlightDetails(item.flightID, dictionaries);

    let numLinesDep = getLines(ctx, flightDetails.depAirportName, cfg.width/2 - cfg.padding.horizontal).length;
    let numLinesArr = getLines(ctx, flightDetails.arrAirportName, cfg.width/2 - cfg.padding.horizontal).length;

    let maxLines = Math.max(numLinesDep, numLinesArr);

    height += maxLines * cfg.heights.airportNameLine;

    height += cfg.heights.flightDetailsHeader;
    height += cfg.heights.flightDetailsText;
    if(flightDetails.plusOneDay){
        height += cfg.heights.plusOneDay;
    }
    height += cfg.padding.vertical;

    return height;
}

function getFlightDetails(id, dictionaries){
    let flightObj = dictionaries.flight[id];
    let location = dictionaries.location;

    let depDateObj = new Date(flightObj.departure.dateTime.slice(0,-6));
    let arrDateObj = new Date(flightObj.arrival.dateTime.slice(0,-6));

    let depDateStr = depDateObj.getDate() + " " + depDateObj.toLocaleString('default', { month: 'short' }) + " " + depDateObj.getFullYear();
    let depTime = ("0" + depDateObj.getHours()).slice(-2) + ":" + ("0" + depDateObj.getMinutes()).slice(-2);
    let arrTime = ("0" + arrDateObj.getHours()).slice(-2) + ":" + ("0" + arrDateObj.getMinutes()).slice(-2);
    
    let plusOneDay = depDateObj.getDate() !== arrDateObj.getDate();

    return {
        flightNum: flightObj.marketingAirlineCode + flightObj.marketingFlightNumber,
        depIATA: flightObj.departure.locationCode,
        arrIATA: flightObj.arrival.locationCode,
        depAirportName: location[flightObj.departure.locationCode].airportName,
        arrAirportName: location[flightObj.arrival.locationCode].airportName,
        depDateStr: depDateStr,
        depTime: depTime,
        arrTime: arrTime,
        plusOneDay: plusOneDay
    }
}

function getLines(ctx, text, maxWidth) {
    var words = text.split(" ");
    var lines = [];
    var currentLine = words[0];
    ctx.font = cfg.fontSize[20];

    for (var i = 1; i < words.length; i++) {
        var word = words[i];
        var width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

function getLayoverText(duration){
    let durationMinTot = duration / 60;
    let durationHours = Math.floor(durationMinTot/60)
    let durationMin = (durationMinTot % 60);
    durationMin = ("0" + durationMin).slice(-2);

    return durationHours + 'h ' + durationMin+'m'
}

module.exports = {
    buildCard
};

