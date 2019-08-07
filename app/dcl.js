var http = require("http"),
    date = />[a-zA-Z]+, ([a-zA-Z]+ [0-9]{2})</g,
    pilotRx = /"view_profile\.php\?uid=([1-9][0-9]*)"/g,
    NUM_DAYS = 7,

    showError = (text) => {
        "use strict";

        document.getElementById("error").innerHTML = text;
        document.getElementById("parameters").classList.remove("hidden");
        document.getElementById("status").classList.add("hidden");
    },

    addStatus = (text) => {
        "use strict";

        var div = document.createElement("div");
        div.innerText = text;
        document.getElementById("status").appendChild(div);
    },

    pageLoad = () => {
        "use strict";
        
        firstDate = new Date(new Date().valueOf() + ((-1 - new Date().getDay())) * 24 * 60 * 60 * 1000);
        firstDate.setHours(0, 0, 0, 0);
        firstRealDate = new Date(firstDate.valueOf() + 1 * 24 * 60 * 60 * 1000);
        lastDate = new Date(firstDate.valueOf() - NUM_DAYS * 24 * 60 * 60 * 1000);
        lastRealDate = new Date(firstDate.valueOf() - (NUM_DAYS - 1) * 24 * 60 * 60 * 1000);

        document.getElementById("startDate").value = (lastRealDate.getMonth() + 1) + "/" + lastRealDate.getDate() + "/" + lastRealDate.getFullYear();
        document.getElementById("endDate").value = (firstDate.getMonth() + 1) + "/" + firstDate.getDate() + "/" + firstDate.getFullYear();
    },

    createReport = () => {
        "use strict";

        document.getElementById("parameters").classList.add("hidden");
        document.getElementById("status").innerHTML = "";
        document.getElementById("status").classList.remove("hidden");

        try {
            lastRealDate = new Date(document.getElementById("startDate").value);
            firstDate = new Date(document.getElementById("endDate").value);
            firstRealDate = new Date(firstDate.valueOf() + 1 * 24 * 60 * 60 * 1000);
            lastDate = new Date(lastRealDate.valueOf() - 1 * 24 * 60 * 60 * 1000);
        } catch (err) {
            showError("Please enter valid dates.");
            return;
        }

        var index = 0,
            pilots = {},
            doCallback = true,

            getPilot = (pilotId, callback) => {
                "use strict";

                http.get("http://descentchampions.org/pilot_data.php?uid=" + pilotId + "&season=lifetime", (res) => {
                    addStatus("Getting pilot " + pilotId);
                    var body = "";

                    res.on("data", (data) => {
                        body += data;
                    });

                    res.on("end", () => {
                        var pilot;

                        try {
                            pilot = JSON.parse(body);
                        } catch (err) {
                            showError("Bad response from DCL while retrieving pilot " + pilotId + "<br />" + err);
                            callback({
                                error: "Bad response from DCL.",
                                status: 502
                            });
                            return;
                        }

                        pilot.matches.forEach((match) => {
                            match.date = new Date(match.date).toString();
                        });

                        pilots[pilotId] = pilot;

                        callback();
                    });
                }).on("error", (err) => {
                    showError("Error while retrieving pilot " + pilotId + " from DCL.<br />" + err);
                    callback({
                        error: "Bad response from DCL.",
                        status: 502
                    });
                });
            },

            getPage = (pageId, callback) => {
                http.get("http://descentchampions.org/recent_matches.php?page=" + pageId + "&season=lifetime", (res) => {
                    addStatus("Getting page " + pageId);

                    var body = "";

                    res.on("data", (data) => {
                        body += data;
                    });

                    res.on("end", () => {
                        var results,
                            parsedDate;

                        while ((results = date.exec(body)) !== null) {
                            parsedDate = new Date(results[1] + " " + new Date().getFullYear());
                            if (parsedDate > new Date()) {
                                parsedDate = new Date(parsedDate.getFullYear() - 1, parsedDate.getMonth(), parsedDate.getDate());
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
                }).on("error", (err) => {
                    showError("Error while retrieving page " + pageId + " from DCL.<br />" + err);
                    callback({
                        error: "Bad response from DCL.",
                        status: 502
                    });
                });
            },

            getNextPage = (err) => {
                if (err) {
                    showError("Error getting page.<br />" + err);
                    return;
                }

                if (index < 10 && doCallback) {
                    getPage(index, getNextPage);
                    index++;
                    return;
                }

                getNextPilot();
            },

            getNextPilot = (err) => {
                var matches = {},
                    sortedPilots = {},
                    html = "",
                    totalMatches = 0,
                    pilotId, index, index2, match, pilot, game,

                    compare = (a, b) => {
                        return b.rank - a.rank;
                    },

                    gameHtml = (game, threatening, domination) => {
                        if (threatening && game.pilot.score >= 15) {
                            if (game.pilot.score > game.opponent.score) {
                                return "(<a target=\"blank\" class=\"link\" href=\"http://descentchampions.org/view_match.php?id=" + game.match + "\">link</a>) <span class=\"darkhorse\">W " + game.pilot.score + " to " + game.opponent.score + " " + game.opponent.name + " (" + game.suicides + " suicides) " + game.game + " " + game.map + " <b>DARK HORSE</b>" + (game.trophy !== 0 ? " <i>Trophy Match</i>" : "") + "</span><br />";
                            } else {
                                return "(<a target=\"blank\" class=\"link\" href=\"http://descentchampions.org/view_match.php?id=" + game.match + "\">link</a>) <span class=\"threat\">L " + game.pilot.score + " to " + game.opponent.score + " " + game.opponent.name + " (" + game.suicides + " suicides) " + game.game + " " + game.map + " <b>THREAT</b>" + (game.trophy !== 0 ? " <i>Trophy Match</i>" : "") + "</span><br />";
                            }
                        } else {
                            if (domination !== false && game.opponent.score <= domination) {
                                return "(<a target=\"blank\" class=\"link\" href=\"http://descentchampions.org/view_match.php?id=" + game.match + "\">link</a>) <span class=\"domination\">W " + game.pilot.score + " to " + game.opponent.score + " " + game.opponent.name + " (" + game.suicides + " suicides) " + game.game + " " + game.map + " <b>DOMINATION</b>" + (game.trophy !== 0 ? " <i>Trophy Match</i>" : "") + "</span><br />";
                            } else if (game.pilot.score > game.opponent.score && game.opponent.score >= 15) {
                                return "(<a target=\"blank\" class=\"link\" href=\"http://descentchampions.org/view_match.php?id=" + game.match + "\">link</a>) <span class=\"closegame\">W " + game.pilot.score + " to " + game.opponent.score + " " + game.opponent.name + " (" + game.suicides + " suicides) " + game.game + " " + game.map + " <b>CLOSE GAME</b>" + (game.trophy !== 0 ? " <i>Trophy Match</i>" : "") + "</span><br />";
                            } else {
                                return "(<a target=\"blank\" class=\"link\" href=\"http://descentchampions.org/view_match.php?id=" + game.match + "\">link</a>) " + (game.pilot.score > game.opponent.score ? "W" : "L") + " " + game.pilot.score + " to " + game.opponent.score + " " + game.opponent.name + " (" + game.suicides + " suicides) " + game.game + " " + game.map + (game.trophy !== 0 ? " <i>Trophy Match</i>" : "") + "<br />";
                            }
                        }
                    };

                if (err) {
                    showError("Error getting pilots.<br />" + err);
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
                document.getElementById("parameters").classList.add("hidden");
                document.getElementById("status").classList.add("hidden");
                document.getElementById("results").innerHTML = html;
            };

        getNextPage();
    },

    firstDate, lastDate, firstRealDate, lastRealDate;
