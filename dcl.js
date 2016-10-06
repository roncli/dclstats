var http = require("http"),
    fs = require("fs"),
    date = />[a-zA-Z]+, ([a-zA-Z]+ [0-9]{2})</g,
    pilotRx = /"view_profile\.php\?uid=([1-9][0-9]*)"/g,
    firstDate = new Date(new Date().valueOf() + ((6 - new Date().getDay())) * 24 * 60 * 60 * 1000),
    lastDate,
    firstRealDate,
    lastRealDate,
    NUM_DAYS = 8;

firstDate.setHours(0, 0, 0, 0);
firstRealDate = new Date(firstDate.valueOf() + 1 * 24 * 60 * 60 * 1000);
lastDate = new Date(firstDate.valueOf() - NUM_DAYS * 24 * 60 * 60 * 1000);
lastRealDate = new Date(firstDate.valueOf() - (NUM_DAYS - 1) * 24 * 60 * 60 * 1000);

getPilots = function() {
    "use strict";

    var index = 0,
        pilots = {},
        doCallback = true,

        getPilot = function(pilotId, callback) {
            "use strict";

            http.get("http://descentchampions.org/pilot_data.php?uid=" + pilotId, function(res) {
                console.log("Getting pilot " + pilotId);
                var body = "";

                res.on("data", function(data) {
                    body += data;
                });

                res.on("end", function() {
                    var pilot;

                    try {
                        pilot = JSON.parse(body);
                    } catch (err) {
                        console.log("Bad response from DCL while retrieving pilot " + pilotId);
                        console.log(err);
                        callback({
                            error: "Bad response from DCL.",
                            status: 502
                        });
                        return;
                    }

                    pilot.matches.forEach(function(match) {
                        match.date = new Date(match.date).toString();
                    });

                    pilots[pilotId] = pilot;

                    callback();
                });
            }).on("error", function(err) {
                console.log("Error while retrieving pilot " + pilotId + " from DCL.");
                console.log(err);
                callback({
                    error: "Bad response from DCL.",
                    status: 502
                });
            });
        },

        getPage = function(pageId, callback) {
            http.get("http://descentchampions.org/recent_matches.php?page=" + pageId, function(res) {
                console.log("Getting page " + pageId);

                var body = "";

                res.on("data", function(data) {
                    body += data;
                });

                res.on("end", function() {
                    var results,
                        parsedDate;

                    while ((results = date.exec(body)) !== null) {

                        parsedDate = new Date(results[1] + " " + new Date().getFullYear());
                        if (new Date(parsedDate.valueOf() - 100 * 24 * 60 * 60 * 1000) > new Date()) {
                            parsedDate = new Date(parsedDate.getFullYear() - 1, parsedDate.getMonth(), parsedDate.getDay());
                        }

                        if (parsedDate < lastDate) {
                            doCallback = false;
                        }
                    }

                    while((results = pilotRx.exec(body)) !== null) {
                        pilots[results[1]] = true;
                    }

                    callback();
                });
            }).on("error", function(err) {
                console.log("Error while retrieving page " + pageId + " from DCL.");
                console.log(err);
                callback({
                    error: "Bad response from DCL.",
                    status: 502
                });
            });
        },

        getNextPage = function(err) {
            if (err) {
                console.log("Error getting page.");
                console.log(err);
                return;
            }

            if (index < 10 && doCallback) {
                getPage(index, getNextPage);
                index++;
                return;
            }

            getNextPilot();
        },

        getNextPilot = function(err) {
            var matches = {},
                sortedPilots = {},
                html = "",
                totalMatches = 0,
                pilotId, index, index2, match, pilot, game,

                compare = function(a, b) {
                    return b.rank - a.rank;
                },

                gameHtml = function(game, threatening, domination) {
                    if (threatening && game.pilot.score >= 15) {
                        if (game.pilot.score > game.opponent.score) {
                            return "(<a target=\"blank\" class=\"link\" href=\"http://descentchampions.org/view_match.php?id=" + game.match + "\">link</a>) <span class=\"darkhorse\">W " + game.pilot.score + " to " + game.opponent.score + " " + game.opponent.name + " (" + game.suicides + " suicides) " + game.game + " " + game.map + " <b>DARK HORSE</b>" + (game.trophy !== 0 ? " <i>Trophy Match</i>" : "") + "</span><br />";
                        } else {
                            return "(<a target=\"blank\" class=\"link\" href=\"http://descentchampions.org/view_match.php?id=" + game.match + "\">link</a>) <span class=\"threat\">L " + game.pilot.score + " to " + game.opponent.score + " " + game.opponent.name + " (" + game.suicides + " suicides) " + game.game + " " + game.map + " <b>THREAT</b>" + (game.trophy !== 0 ? " <i>Trophy Match</i>" : "") + "</span><br />";
                        }
                    } else {
                        if (domination !== false && game.opponent.score <= domination) {
                            return "(<a target=\"blank\" class=\"link\" href=\"http://descentchampions.org/view_match.php?id=" + game.match + "\">link</a>) <span class=\"domination\">W " + game.pilot.score + " to " + game.opponent.score + " " + game.opponent.name + " (" + game.suicides + " suicides) " + game.game + " " + game.map + " <b>DOMINATION</b>" + (game.trophy !== 0 ? " <i>Trophy Match</i>" : "") + "</span><br />";
                        } else {
                            return "(<a target=\"blank\" class=\"link\" href=\"http://descentchampions.org/view_match.php?id=" + game.match + "\">link</a>) " + (game.pilot.score > game.opponent.score ? "W" : "L") + " " + game.pilot.score + " to " + game.opponent.score + " " + game.opponent.name + " (" + game.suicides + " suicides) " + game.game + " " + game.map + (game.trophy !== 0 ? " <i>Trophy Match</i>" : "") + "<br />";
                        }
                    }
                };

            if (err) {
                console.log("Error getting pilots.");
                console.log(err);
                return;
            }

            for (pilotId in pilots) {
                if (pilots.hasOwnProperty(pilotId)) {
                    if (pilots[pilotId] === true) {
                        getPilot(pilotId, getNextPilot);
                        return;
                    }
                }
            }

            for (pilotId in pilots) {
                if (pilots.hasOwnProperty(pilotId)) {
                    pilots[pilotId].totalGames = 0;
                    pilots[pilotId].games = {};
                    pilots[pilotId].record = {};
                    for (index in pilots[pilotId].matches) {
                        if (pilots[pilotId].matches.hasOwnProperty(index)) {
                            match = pilots[pilotId].matches[index];
                            if (new Date(match.date) < firstRealDate && new Date(match.date) >= lastRealDate) {
                                pilots[pilotId].totalGames++;

                                if (!pilots[pilotId].games.hasOwnProperty(match.opponent.rating)) {
                                    pilots[pilotId].games[match.opponent.rating] = [];
                                }
                                pilots[pilotId].games[match.opponent.rating].push(match);

                                if (!pilots[pilotId].record.hasOwnProperty(match.opponent.rating)) {
                                    pilots[pilotId].record[match.opponent.rating] = {wins: 0, losses: 0};
                                }

                                if (match.pilot.score > match.opponent.score) {
                                    totalMatches++;
                                    if (!matches.hasOwnProperty(match.pilot.rating + " wins vs " + match.opponent.rating)) {
                                        matches[match.pilot.rating + " wins vs " + match.opponent.rating] = 0;
                                    }
                                    matches[match.pilot.rating + " wins vs " + match.opponent.rating]++;
                                    pilots[pilotId].record[match.opponent.rating].wins++;
                                } else {
                                    pilots[pilotId].record[match.opponent.rating].losses++;
                                }
                            }
                        }
                    }

                    if (pilots[pilotId].totalGames > 0) {
                        if (!sortedPilots.hasOwnProperty(pilots[pilotId].rating)) {
                            sortedPilots[pilots[pilotId].rating] = [];
                        }
                        sortedPilots[pilots[pilotId].rating].push(pilots[pilotId]);
                    }
                }
            }

            html = "<style>* {font-family: Arial; color: grey;} h2 {color: red;} h3 {color: blue;} h1, h4 {color: black;} .darkhorse {color: red; font-weight: bold;} .threat {color: blue; font-weight: bold;} .domination {color: green; font-weight: bold;} .link {color: blue;}</style>";
            html = html + "<h1>DCL Report</h1>";
            html = html + "<h4>" + (lastRealDate.getMonth() + 1) + "/" + lastRealDate.getDate() + " to " + (firstDate.getMonth() + 1) + "/" + firstDate.getDate() + "</h4>";
            html = html + "Total matches: " + totalMatches + "<br />";
            for (index in matches) {
                if (matches.hasOwnProperty(index)) {
                    html = html + index + ": " + matches[index] + "<br />";
                }
            }

            if (sortedPilots.unrated) {
                html = html + "<h2>Unrated</h2>";
                sortedPilots.unrated.sort(compare);
                for (index in sortedPilots.unrated) {
                    if (sortedPilots.unrated.hasOwnProperty(index)) {
                        pilot = sortedPilots.unrated[index];
                        html = html + "<h3>" + pilot.rank + ") " + pilot.name + "</h3>";
                        html = html + "<b>Total Games: " + pilot.totalGames + "</b><br />";
                        for (index2 in pilot.record) {
                            if (pilot.record.hasOwnProperty(index2)) {
                                html = html + index2 + ": " + pilot.record[index2].wins + "-" + pilot.record[index2].losses + "<br />";
                            }
                        }
                        if (pilot.games.unrated) {
                            html = html + "<h4>Vs. Unrated</h4>";
                            for (index2 in pilot.games.unrated) {
                                if (pilot.games.unrated.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.unrated[index2], false, false);
                                }
                            }
                        }
                        if (pilot.games.bronze) {
                            html = html + "<h4>Vs. Bronze</h4>";
                            for (index2 in pilot.games.bronze) {
                                if (pilot.games.bronze.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.bronze[index2], false, false);
                                }
                            }
                        }
                        if (pilot.games.silver) {
                            html = html + "<h4>Vs. Silver</h4>";
                            for (index2 in pilot.games.silver) {
                                if (pilot.games.silver.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.silver[index2], false, false);
                                }
                            }
                        }
                        if (pilot.games.gold) {
                            html = html + "<h4>Vs. Gold</h4>";
                            for (index2 in pilot.games.gold) {
                                if (pilot.games.gold.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.gold[index2], false, false);
                                }
                            }
                        }
                        if (pilot.games.diamond) {
                            html = html + "<h4>Vs. Diamond</h4>";
                            for (index2 in pilot.games.diamond) {
                                if (pilot.games.diamond.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.diamond[index2], false, false);
                                }
                            }
                        }
                    }
                }
            }

            if (sortedPilots.bronze) {
                html = html + "<h2>Bronze</h2>";
                sortedPilots.bronze.sort(compare);
                for (index in sortedPilots.bronze) {
                    if (sortedPilots.bronze.hasOwnProperty(index)) {
                        pilot = sortedPilots.bronze[index];
                        html = html + "<h3>" + pilot.rank + ") " + pilot.name + "</h3>";
                        html = html + "<b>Total Games: " + pilot.totalGames + "</b><br />";
                        for (index2 in pilot.record) {
                            if (pilot.record.hasOwnProperty(index2)) {
                                html = html + index2 + ": " + pilot.record[index2].wins + "-" + pilot.record[index2].losses + "<br />";
                            }
                        }
                        if (pilot.games.unrated) {
                            html = html + "<h4>Vs. Unrated</h4>";
                            for (index2 in pilot.games.unrated) {
                                if (pilot.games.unrated.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.unrated[index2], false, false);
                                }
                            }
                        }
                        if (pilot.games.bronze) {
                            html = html + "<h4>Vs. Bronze</h4>";
                            for (index2 in pilot.games.bronze) {
                                if (pilot.games.bronze.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.bronze[index2], false, 10);
                                }
                            }
                        }
                        if (pilot.games.silver) {
                            html = html + "<h4>Vs. Silver</h4>";
                            for (index2 in pilot.games.silver) {
                                if (pilot.games.silver.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.silver[index2], true, false);
                                }
                            }
                        }
                        if (pilot.games.gold) {
                            html = html + "<h4>Vs. Gold</h4>";
                            for (index2 in pilot.games.gold) {
                                if (pilot.games.gold.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.gold[index2], true, false);
                                }
                            }
                        }
                        if (pilot.games.diamond) {
                            html = html + "<h4>Vs. Diamond</h4>";
                            for (index2 in pilot.games.diamond) {
                                if (pilot.games.diamond.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.diamond[index2], true, false);
                                }
                            }
                        }
                    }
                }
            }

            if (sortedPilots.silver) {
                html = html + "<h2>Silver</h2>";
                sortedPilots.silver.sort(compare);
                for (index in sortedPilots.silver) {
                    if (sortedPilots.silver.hasOwnProperty(index)) {
                        pilot = sortedPilots.silver[index];
                        html = html + "<h3>" + pilot.rank + ") " + pilot.name + "</h3>";
                        html = html + "<b>Total Games: " + pilot.totalGames + "</b><br />";
                        for (index2 in pilot.record) {
                            if (pilot.record.hasOwnProperty(index2)) {
                                html = html + index2 + ": " + pilot.record[index2].wins + "-" + pilot.record[index2].losses + "<br />";
                            }
                        }
                        if (pilot.games.unrated) {
                            html = html + "<h4>Vs. Unrated</h4>";
                            for (index2 in pilot.games.unrated) {
                                if (pilot.games.unrated.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.unrated[index2], false, false);
                                }
                            }
                        }
                        if (pilot.games.bronze) {
                            html = html + "<h4>Vs. Bronze</h4>";
                            for (index2 in pilot.games.bronze) {
                                if (pilot.games.bronze.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.bronze[index2], false, 5);
                                }
                            }
                        }
                        if (pilot.games.silver) {
                            html = html + "<h4>Vs. Silver</h4>";
                            for (index2 in pilot.games.silver) {
                                if (pilot.games.silver.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.silver[index2], false, 10);
                                }
                            }
                        }
                        if (pilot.games.gold) {
                            html = html + "<h4>Vs. Gold</h4>";
                            for (index2 in pilot.games.gold) {
                                if (pilot.games.gold.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.gold[index2], true, false);
                                }
                            }
                        }
                        if (pilot.games.diamond) {
                            html = html + "<h4>Vs. Diamond</h4>";
                            for (index2 in pilot.games.diamond) {
                                if (pilot.games.diamond.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.diamond[index2], true, false);
                                }
                            }
                        }
                    }
                }
            }

            if (sortedPilots.gold) {
                html = html + "<h2>Gold</h2>";
                sortedPilots.gold.sort(compare);
                for (index in sortedPilots.gold) {
                    if (sortedPilots.gold.hasOwnProperty(index)) {
                        pilot = sortedPilots.gold[index];
                        html = html + "<h3>" + pilot.rank + ") " + pilot.name + "</h3>";
                        html = html + "<b>Total Games: " + pilot.totalGames + "</b><br />";
                        for (index2 in pilot.record) {
                            if (pilot.record.hasOwnProperty(index2)) {
                                html = html + index2 + ": " + pilot.record[index2].wins + "-" + pilot.record[index2].losses + "<br />";
                            }
                        }
                        if (pilot.games.unrated) {
                            html = html + "<h4>Vs. Unrated</h4>";
                            for (index2 in pilot.games.unrated) {
                                if (pilot.games.unrated.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.unrated[index2], false, false);
                                }
                            }
                        }
                        if (pilot.games.bronze) {
                            html = html + "<h4>Vs. Bronze</h4>";
                            for (index2 in pilot.games.bronze) {
                                if (pilot.games.bronze.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.bronze[index2], false, 0);
                                }
                            }
                        }
                        if (pilot.games.silver) {
                            html = html + "<h4>Vs. Silver</h4>";
                            for (index2 in pilot.games.silver) {
                                if (pilot.games.silver.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.silver[index2], false, 5);
                                }
                            }
                        }
                        if (pilot.games.gold) {
                            html = html + "<h4>Vs. Gold</h4>";
                            for (index2 in pilot.games.gold) {
                                if (pilot.games.gold.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.gold[index2], false, 10);
                                }
                            }
                        }
                        if (pilot.games.diamond) {
                            html = html + "<h4>Vs. Diamond</h4>";
                            for (index2 in pilot.games.diamond) {
                                if (pilot.games.diamond.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.diamond[index2], true, false);
                                }
                            }
                        }
                    }
                }
            }

            if (sortedPilots.diamond) {
                html = html + "<h2>Diamond</h2>";
                sortedPilots.diamond.sort(compare);
                for (index in sortedPilots.diamond) {
                    if (sortedPilots.diamond.hasOwnProperty(index)) {
                        pilot = sortedPilots.diamond[index];
                        html = html + "<h3>" + pilot.rank + ") " + pilot.name + "</h3>";
                        html = html + "<b>Total Games: " + pilot.totalGames + "</b><br />";
                        for (index2 in pilot.record) {
                            if (pilot.record.hasOwnProperty(index2)) {
                                html = html + index2 + ": " + pilot.record[index2].wins + "-" + pilot.record[index2].losses + "<br />";
                            }
                        }
                        if (pilot.games.unrated) {
                            html = html + "<h4>Vs. Unrated</h4>";
                            for (index2 in pilot.games.unrated) {
                                if (pilot.games.unrated.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.unrated[index2], false, false);
                                }
                            }
                        }
                        if (pilot.games.bronze) {
                            html = html + "<h4>Vs. Bronze</h4>";
                            for (index2 in pilot.games.bronze) {
                                if (pilot.games.bronze.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.bronze[index2], false, 0);
                                }
                            }
                        }
                        if (pilot.games.silver) {
                            html = html + "<h4>Vs. Silver</h4>";
                            for (index2 in pilot.games.silver) {
                                if (pilot.games.silver.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.silver[index2], false, 5);
                                }
                            }
                        }
                        if (pilot.games.gold) {
                            html = html + "<h4>Vs. Gold</h4>";
                            for (index2 in pilot.games.gold) {
                                if (pilot.games.gold.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.gold[index2], false, 10);
                                }
                            }
                        }
                        if (pilot.games.diamond) {
                            html = html + "<h4>Vs. diamond</h4>";
                            for (index2 in pilot.games.diamond) {
                                if (pilot.games.diamond.hasOwnProperty(index2)) {
                                    html = html + gameHtml(pilot.games.diamond[index2], false, 10);
                                }
                            }
                        }
                    }
                }
            }
            fs.writeFile("dcl.htm", html, function() {});
        };

    getNextPage();
};

getPilots();
