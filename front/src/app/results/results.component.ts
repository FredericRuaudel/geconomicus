import {AfterViewInit, Component, OnInit} from '@angular/core';
import {Subscription} from "rxjs";
import {ActivatedRoute, Router} from "@angular/router";
import {BackService} from "../services/back.service";
import {SnackbarService} from "../services/snackbar.service";
import io from "socket.io-client";
import {EventGeco, Game, Player} from "../models/game";
import * as _ from 'lodash-es';
import {LoadingService} from "../services/loading.service";
import {environment} from "../../environments/environment";
// @ts-ignore
import * as C from "../../../../config/constantes";

import {BubbleDataPoint, ChartConfiguration, ChartDataset, ChartTypeRegistry, Point} from 'chart.js';
import 'chartjs-adapter-date-fns';
// import {fr} from 'date-fns/locale';
import {parseISO, subSeconds} from 'date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import Chart from 'chart.js/auto';

Chart.register(zoomPlugin);


@Component({
  selector: 'app-results',
  templateUrl: './results.component.html',
  styleUrls: ['./results.component.scss']
})
export class ResultsComponent implements OnInit, AfterViewInit {
  private socket: any;
  idGame: string = "";
  private subscription: Subscription | undefined;

  game: Game | undefined;
  events: EventGeco[] = [];
  players: Player[] = [];
  datasets: Map<string, ChartDataset> = new Map<string, ChartDataset>();
  datasetsRelatif: Map<string, ChartDataset> = new Map<string, ChartDataset>();
  datasetsResources: Map<string, ChartDataset> = new Map<string, ChartDataset>();
  datasetsFeedback: ChartDataset[] = [];
  currentDU = 0;
  initialDU = 0;
  initialMM = 0;
  initialDebts = 0;
  reincarnates = 0;
  startGameDate: Date | undefined;
  stopGameDate: Date | undefined;
  roundStarted = false;
  pointsBefore1second = true;
  C = C;
  baseRadius: number = 2.1;
  nbPlayer = 0;


  durationGame() {
    if (this.startGameDate && this.stopGameDate) {
      let start = new Date(this.startGameDate);
      let end = new Date(this.stopGameDate);
      let durationInMilliseconds = end.getTime() - start.getTime();
      let durationInMinutes = Math.floor(durationInMilliseconds / (1000 * 60));
      return durationInMinutes + " minutes";
    }
    return "-";
  }

  getDebts() {
    let debt = 0;
    _.forEach(this.game?.credits, c => {
      if (c.status != C.CREDIT_DONE) {
        debt += (c.amount + c.interest)
      }
    });
    return debt;
  }

  getStatus() {
    switch (this.game?.status) {
      case C.OPEN:
        return "Ouvert à rejoindre";
      case C.PLAYING:
        return "En cours";
      case C.END_GAME:
        return "Jeu Terminé";
      case C.STOP_ROUND:
        return "Tour terminé";
      case C.INTER_ROUND :
        return 'Inter tour';
      case C.START_GAME :
        return 'Jeu démarré';
      default:
        return "-";

    }
  }

  public lineChartData: ChartConfiguration['data'] | undefined;
  public lineChartOptions: ChartConfiguration['options'] = {
    elements: {
      line: {
        tension: 0.1,
      },
    },
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time',
        ticks: {source: "auto"},
        time: {
          unit: 'minute',
          displayFormats: {
            minute: 'HH:mm'
          },
        },
      },
      y: {
        min: 0,
        type: 'logarithmic',
        // ticks: {
        // min: 0, // Minimum Y-axis value (10^0)
        // max: 1000, // Maximum Y-axis value (10^3)
        // stepSize: 1, // Step size between ticks
        // callback: function (value, index, values) {
        //   return value; // Display tick values as they are (e.g., 10, 100, 1000)
        // }
        // }
      },
    },
    plugins: {
      zoom: {
        limits: {
          y: {min: 0},
        },
        pan: {
          enabled: true,
          mode: 'xy', // Enable both X and Y panning
        },
        zoom: {
          wheel: {
            enabled: true,
            modifierKey: 'ctrl',

          },
          pinch: {
            enabled: true,
          },
          mode: 'xy', // Enable both X and Y zooming
        },
      },
    },
  };

  public lineChartDataRelatif: ChartConfiguration['data'] | undefined;
  public lineChartOptionsRelatif: ChartConfiguration['options'] = {
    elements: {
      line: {
        tension: 0.1,
      },
    },
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time',
        ticks: {source: "auto"},
        time: {
          unit: 'minute',
          displayFormats: {
            minute: 'HH:mm'
          },
        },
      },
      y: {
        min: 0,
      },
    },
    plugins: {
      zoom: {
        limits: {
          y: {min: 0},
        },
        pan: {
          enabled: true,
          mode: 'xy'
        },
        zoom: {
          wheel: {
            enabled: true,
            modifierKey: 'ctrl',
          },
          pinch: {
            enabled: true
          },
          mode: 'xy'
        }
      }
    }
  };

  public lineChartDataResources: ChartConfiguration['data'] | undefined;
  public lineChartOptionsResources: ChartConfiguration['options'] = {
    elements: {
      line: {
        tension: 0.1,
      },
    },
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time',
        ticks: {source: "auto"},
        time: {
          unit: 'minute',
          displayFormats: {
            minute: 'HH:mm'
          },
        },
      },
      y: {
        min: 0,
      },
    },
    plugins: {
      zoom: {
        limits: {
          y: {min: 0},
        },
        pan: {
          enabled: true,
          mode: 'xy'
        },
        zoom: {
          wheel: {
            modifierKey: 'ctrl',
            enabled: true,
          },
          pinch: {
            enabled: true
          },
          mode: 'xy'
        }
      }
    }
  };

  public feedbacksData: ChartConfiguration['data'] | undefined;

  public feedbacksLabelsTop = [
    "Joyeux",
    "Collectif",
    "En Communauté",
    "Génereux",
    "Coopératif",
    "Confiant",
    "Avenant",
    "Tolérant",
    "Autonome"];
  public feedbacksLabelsBottom = [
    "Déprimé",
    "Individuel",
    "Seul(e)",
    "Avar",
    "Compétitif",
    "Anxieux",
    "Agréssif",
    "Irritable",
    "Dépendant"];
  public leftLabels = [
    "Trés",
    "Assez",
    "Un peu",
    "neutre",
    "Un peu",
    "Assez",
    "Trés"];
  public feedbacksOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          // @ts-ignore
          label: function (tooltipItem) {
            // @ts-ignore
            return tooltipItem.raw.count;
          },
        },
      },
    },
    scales: {
      x: {display: false, ticks: {stepSize: 1}},
      y: {display: false, ticks: {stepSize: 1}, type: "linear", min: -3, max: 3,},
      x2: {position: "top", type: "category", labels: this.feedbacksLabelsTop,},
      x3: {position: "bottom", type: "category", labels: this.feedbacksLabelsBottom,},
      y2: {position: "left", type: "category", labels: this.leftLabels,},
    },
  };


  constructor(private route: ActivatedRoute, private router: Router, private backService: BackService, private snackbarService: SnackbarService, private loadingService: LoadingService) {
  }

  ngOnInit(): void {
    this.subscription = this.route.params.subscribe(params => {
      this.idGame = params['idGame'];
      this.backService.getGame(this.idGame).subscribe(async game => {
        this.game = game;
        this.events = game.events;
        this.players = game.players;
        this.nbPlayer = _.partition(this.players, p => p.status === C.ALIVE).length;
        await this.initDatasets();
        if (this.game?.typeMoney == C.JUNE) {
          const firstDu = _.find(this.events, e => {
            return e.typeEvent == C.FIRST_DU || e.typeEvent == "first_DU";
          });
          if (firstDu) {
            this.currentDU = firstDu.amount;
          }
        }
        this.addEventsToDatasets(this.events);
      });
      this.socket = io(environment.API_HOST, {
        query: {
          idPlayer: this.idGame + C.EVENT,
          idGame: this.idGame,
        },
      });
    });
  }

  ngAfterViewInit() {
    this.socket.on(this.idGame + C.EVENT, async (data: any) => {
      this.events.push(data.event);
    });
    this.socket.on(this.idGame + C.NEW_FEEDBACK, async (data: any) => {
      window.location.reload();
    });
  }

  hexToRgb(hex: string): string {
    // Remove the # symbol if present
    hex = hex.replace(/^#/, '');

    // Parse the hex value to an integer
    const hexValue = parseInt(hex, 16);

    // Extract the red, green, and blue components
    const red = (hexValue >> 16) & 255;
    const green = (hexValue >> 8) & 255;
    const blue = hexValue & 255;

    // Create the RGB string
    return `rgba(${red}, ${green}, ${blue},1)`;
  }

  getRandomColor(): string {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return `rgba(${r}, ${g}, ${b}, ${0.6})`;
  }

  async initDatasets() {
    // Initialize empty dataset for each player with a running total
    const players = _.sortBy(this.players, 'name');
    _.forEach(players, player => {
      this.datasets.set(
        player._id,
        {
          data: [],
          label: player.name,
          backgroundColor: this.hexToRgb(player.hairColor),
          borderColor: this.hexToRgb(player.hairColor),
          pointBackgroundColor: this.hexToRgb(player.hairColor),
          pointBorderColor: this.hexToRgb(player.hairColor),
          borderWidth: 2, // Line thickness
          pointRadius: 0.8, // Point thickness
          // @ts-ignore
          total: 0,
        });

      this.datasetsRelatif.set(
        player._id,
        {
          data: [],
          label: player.name,
          backgroundColor: this.hexToRgb(player.hairColor),
          borderColor: this.hexToRgb(player.hairColor),
          pointBackgroundColor: this.hexToRgb(player.hairColor),
          pointBorderColor: this.hexToRgb(player.hairColor),
          borderWidth: 2, // Line thickness
          pointRadius: 0.8, // Point thickness
          // @ts-ignore
          total: 0,
        });
      this.datasetsResources.set(
        player._id,
        {
          data: [],
          label: player.name,
          backgroundColor: this.hexToRgb(player.hairColor),
          borderColor: this.hexToRgb(player.hairColor),
          pointBackgroundColor: this.hexToRgb(player.hairColor),
          pointBorderColor: this.hexToRgb(player.hairColor),
          borderWidth: 2, // Line thickness
          pointRadius: 0.8, // Point thickness
          // @ts-ignore
          total: 0,
        });

    });
    this.datasets.set(
      "masseMoney",
      {
        data: [],
        label: "Masse monétaire",
        backgroundColor: this.hexToRgb("#000000"),
        borderColor: this.hexToRgb("#000000"),
        pointBackgroundColor: this.hexToRgb("#000000"),
        pointBorderColor: this.hexToRgb("#000000"),
        borderWidth: 2, // Line thickness
        pointRadius: 0.8, // Point thickness
        // @ts-ignore
        total: 0,
      });
    // this.datasetsRelatif.set(
    //   "masseMoney",
    //   {
    //     data: [],
    //     label: "Masse monétaire",
    //     backgroundColor: this.hexToRgb("#000000"),
    //     borderColor: this.hexToRgb("#000000"),
    //     pointBackgroundColor: this.hexToRgb("#000000"),
    //     pointBorderColor: this.hexToRgb("#000000"),
    //     borderWidth: 2, // Line thickness
    //     pointRadius: 0.8, // Point thickness
    //     @ts-ignore
        // total: 0,
      // });
    this.initFeedbacks();
  }

  initFeedbacks() {
    const playersWithFeedbacks = _.filter(this.players, p => p.survey != undefined);
    const feedbacks = _.map(playersWithFeedbacks, p => p.survey);
    const feedbacksCounts1 = _.countBy(feedbacks, "depressedHappy");
    const feedbacksCounts2 = _.countBy(feedbacks, "individualCollective");
    const feedbacksCounts3 = _.countBy(feedbacks, "aloneIntegrated");
    const feedbacksCounts4 = _.countBy(feedbacks, "greedyGenerous");
    const feedbacksCounts5 = _.countBy(feedbacks, "competitiveCooperative");
    const feedbacksCounts6 = _.countBy(feedbacks, "anxiousConfident");
    const feedbacksCounts7 = _.countBy(feedbacks, "agressiveAvenant");
    const feedbacksCounts8 = _.countBy(feedbacks, "irritableTolerant");
    const feedbacksCounts9 = _.countBy(feedbacks, "dependantAutonomous");
    const feedbacksCounted = [feedbacksCounts1, feedbacksCounts2, feedbacksCounts3, feedbacksCounts4, feedbacksCounts5, feedbacksCounts6, feedbacksCounts7, feedbacksCounts8, feedbacksCounts9];

    // @ts-ignore
    this.datasetsFeedback = _.map(feedbacksCounted, (feedback, index) => {
      let data = _.map(feedback, (count, key) => {
        return {x: index, y: parseInt(key), r: Math.log(count * 2) * 6, count: count}
      });
      return {
        data: data,
        type: 'bubble',
        backgroundColor: this.getRandomColor()
      }
    });

    this.feedbacksData = {
      // @ts-ignore
      datasets: this.datasetsFeedback
    };
  }

  getValueCardsFromEvent(event: EventGeco) {
    return _.reduce(event.resources, function (sum, card) {
      return sum + card.price;
    }, 0);
  }

  addEventsToDatasets(unsortedEvents: EventGeco[]) {
    const events = _.sortBy(unsortedEvents, 'date');

    // Iterate over each event
    for (const event of events) {
      let totalResourcesEvent = 0; //here only because of switch case don't want same name many places
      let mmDataset = this.datasets.get("masseMoney");
      // let mmDatasetRelatif = this.datasetsRelatif.get("masseMoney");
      let emitterDataset = this.datasets.get(event.emitter);
      let emitterDatasetRelatif = this.datasetsRelatif.get(event.emitter);
      let emitterDatasetResources = this.datasetsResources.get(event.emitter);
      let receiverDataset = this.datasets.get(event.receiver);
      let receiverDatasetRelatif = this.datasetsRelatif.get(event.receiver);
      let receiverDatasetResources = this.datasetsResources.get(event.receiver);

      const updateData = (dataset: any, date: string | Date, operator: "add" | "sub" | "new", value: number, relatif: boolean, beforePoint: boolean) => {
        if (dataset) {
          const previousTotal = dataset.total;
          let newTotal = 0;
          if (operator == "add") {
            newTotal = previousTotal + value;
          }else if ( operator == "sub"){
            newTotal = previousTotal - value;
          } else{
            newTotal = value;
          }
          if (beforePoint) {
            addPointBefore1second(dataset, date, relatif ? (previousTotal / this.currentDU) : previousTotal);
          }
          addPointAtEvent(dataset, date, relatif ? (newTotal / this.currentDU) : newTotal);
          dataset.total = newTotal;
        }
      }

      const addPointBefore1second = (dataset: any, date: string | Date, value: number) => {
        // @ts-ignore before
        dataset.data.push({
          // @ts-ignore before
          x: subSeconds(parseISO(date), 1),
          // @ts-ignore before
          y: value
        });
      }
      const addPointAtEvent = (dataset: any, date: string | Date, value: any) => {
        // @ts-ignore
        dataset.data.push({x: date, y: value});
      }

      switch (event.typeEvent) {
        case C.START_GAME:
          this.startGameDate = event.date;
          continue;
        case C.END_GAME:
          this.stopGameDate = event.date;
          continue;
        case C.START_ROUND:
          this.roundStarted = true;
          continue;
        case C.STOP_ROUND:
          continue;
        case C.FIRST_DU:
          this.currentDU = event.amount;
          this.initialDU = event.amount;
          continue;
        case C.INIT_DISTRIB:
          totalResourcesEvent = this.getValueCardsFromEvent(event);
          this.initialMM += event.amount;
          updateData(mmDataset, event.date, "add", event.amount, false, this.pointsBefore1second);
          updateData(receiverDatasetResources, event.date, "add", totalResourcesEvent, false, false);
          updateData(receiverDataset, event.date, "add", event.amount, false, this.pointsBefore1second);
          if (this.game?.typeMoney == C.JUNE && receiverDatasetRelatif) {
            updateData(receiverDatasetRelatif, event.date, "add", event.amount, true, false);
          }
          // @ts-ignore
          // updateData(mmDatasetRelatif, event.date, "new", (mmDataset.total / this.nbPlayer / this.currentDU), false, false);
          continue;
        case C.DISTRIB_DU:
          this.currentDU = event.amount;
          updateData(mmDataset, event.date, "add", event.amount, false, this.pointsBefore1second);
          updateData(receiverDataset, event.date, "add", event.amount, false, false);
          updateData(receiverDatasetRelatif, event.date, "add", event.amount, true, false);
          // @ts-ignore
          // updateData(mmDatasetRelatif, event.date, "new", (mmDataset.total / this.nbPlayer / this.currentDU), false, false);
          continue;
        case C.NEW_CREDIT:
          updateData(mmDataset, event.date, "add", event.amount, false, this.pointsBefore1second);
          updateData(receiverDataset, event.date, "add", event.amount, false, this.pointsBefore1second);
          continue;
        case C.CREDIT_DONE:

          continue;
        case C.TRANSACTION:
          totalResourcesEvent = this.getValueCardsFromEvent(event);
          updateData(emitterDataset, event.date, "sub", event.amount, false, this.pointsBefore1second);
          updateData(emitterDatasetRelatif, event.date, "sub", event.amount, true, this.pointsBefore1second);
          updateData(emitterDatasetResources, event.date, "add", totalResourcesEvent, false, this.pointsBefore1second);

          updateData(receiverDataset, event.date, "add", event.amount, false, this.pointsBefore1second);
          updateData(receiverDatasetRelatif, event.date, "add", event.amount, true, this.pointsBefore1second);
          updateData(receiverDatasetResources, event.date, "sub", totalResourcesEvent, false, this.pointsBefore1second);
          continue;
        case C.TRANSFORM_DISCARDS:
          totalResourcesEvent = this.getValueCardsFromEvent(event);
          if (emitterDatasetResources) {
            // @ts-ignore
            emitterDatasetResources.total -= totalResourcesEvent;
          }
          // no update data to avoid weird graph up and down too quickly
          continue;
        case C.TRANSFORM_NEWCARDS:
          totalResourcesEvent = this.getValueCardsFromEvent(event);
          // no before point , same reason as transform_discards
          updateData(receiverDatasetResources, event.date, "add", totalResourcesEvent, false, false);
          continue;
        case C.DEAD:
          if (receiverDatasetResources) {
            // @ts-ignore
            addPointBefore1second(receiverDatasetResourcesevent.date, receiverDatasetResources.total);
            addPointAtEvent(receiverDatasetResources, event.date, 0);
          }
          continue;
        case C.REMIND_DEAD:
          // @ts-ignore
          receiverDatasetResources.data.push({x: event.date, y: 0});
          continue;
        default:
      }
    }

    // Remove the 'total' property from each dataset ? datasets.forEach(dataset => delete dataset.total);
    this.lineChartData = {
      datasets: [...this.datasets.values()]
    };
    this.lineChartDataRelatif = {
      datasets: [...this.datasetsRelatif.values()]
    };
    this.lineChartDataResources = {
      datasets: [...this.datasetsResources.values()]
    };
  }
}
