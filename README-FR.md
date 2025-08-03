# Introduction

Covalent est une librairie TypeScript qui encapsule et facilite les communications inter-processus entre un back-end
Electron et un ou plusieurs front-end qu'Electron gère.
Cette librairie a été pensée pour des processus de rendu en Angular, mais il reste possible de l'utiliser dans d'autres
types de projets.

Dans Covalent, c'est Electron qui est maître. C'est donc lui qui expose sa logique aux processus de rendu.
Ce sont des classes, appelées _contrôleurs_, qui exposent leurs fonctionnalités.
Du côté des processus de rendu, chaque contrôleur est associé à une (voire plusieurs) classe, appelée _proxy_, qui fait
office de point d'accès aux fonctionnalités exposées par le contrôleur.
Les contrôleurs et les proxys qui leur sont associés partagent une interface commune, appelée _bridge_, qui définit les
fonctions exposées par le contrôleur.

## Types de communication

Covalent gère quatre types de communication inter-processus :

- `SEND` : Envoi d'une information depuis un processus de rendu vers le processus principal.
- `INVOKE` : Envoi d'une information depuis un processus de rendu vers le processus principal et attente d'une réponse.
- `ON` : Envoi d'une information depuis le processus principal vers tous les processus de rendu.
- `CALLBACK` : Envoi d'une information depuis un processus de rendu vers le processus principal et écoute d'un flux de
  retour.

Voici les diagrammes de séquences correspondants :

```mermaid
sequenceDiagram
  note right of Rendu: SEND
  Rendu -) Electron: envoi
  activate Electron
  deactivate Electron
  note right of Rendu: INVOKE
  Rendu -) Electron: envoi
  activate Electron
  Electron --) Rendu: retour
  deactivate Electron
  note right of Rendu: ON
  loop
    Electron -) Rendu: diffusion
    activate Rendu
    deactivate Rendu
  end
  note right of Rendu: CALLBACK
  Rendu -) Electron: ouverture
  activate Electron
  loop
    Electron --) Rendu: retour
    activate Rendu
    deactivate Rendu
  end
  Rendu -x Electron: fermeture
  deactivate Electron
```

Puisqu'il s'agit de communications inter-processus, les appels sont tous asynchrones.

## Exemples

Dans les sections suivantes, les interfaces suivantes seront utilisées pour les exemples de code :

```typescript
import { Bridge } from "@covalent/types";

export type ClickEvent = { buttons: number; x: number; y: number; ctrl: boolean };

// descriptions du point de vue d'un processus de rendu

export interface ExampleBridge {
  doAction: Bridge.Send<string>; // envoi d'un string
  getConfig: Bridge.Invoke<void, { url: string }>; // demande d'un objet
  calculate: Bridge.Invoke<{ x: number }, number>; // envoi d'un objet et réception d'un nombre
  onDate: Bridge.On<Date>; // écoute d'une date
  onClick: Bridge.On<ClickEvent>; // écoute d'un événement de clic
  watchMetrics: Bridge.Callback<{ period: number }, { percentCpuUsage: number }>; // envoi d'une période et écoute d'une statistique
}
```

# Utilisation côté Electron

## Installation

Pour installer Covalent dans votre projet Electron, entrez la commande suivante :

```shell
npm i @covalent/core
```

## Définition

Pour définir un contrôleur, il suffit d'ajouter le décorateur `Controller` à une classe.

```typescript
import { interval, map, Subject } from "rxjs";
import { BridgeType, CallbackSubject, Controller } from "@covalent/core";

@Controller<ExampleController, ExampleBridge>({
  group: "example",
  bridge: {
    doAction: BridgeType.SEND,
    getConfig: BridgeType.INVOKE,
    calculate: BridgeType.INVOKE,
    onDate: BridgeType.ON,
    onClick: BridgeType.ON,
    watchMetrics: BridgeType.CALLBACK,
  },
  handlers: (self) => ({
    doAction: self.doAction,
    getConfig: () => self.config,
    calculate: self.calculate,
    watchMetrics: self.startWatchingMetrics,
  }),
  triggers: (self) => ({
    onDate: interval(200).pipe(map(() => new Date())),
    onClick: self.clickSubject.asObservable(),
  })
})
export class ExampleController {
  constructor(private readonly anotherController: AnotherController, ...) {
  }

  private clickSubject = new Subject<ClickEvent>();

  private doAction(action: string) { ...
  }

  public get config(): { url: string } { ...
  }

  private calculate(params: { x: number }): number { ...
  }

  public startWatchingMetrics(subject: CallbackSubject<{ percentCpuUsage: number }>, input: { period: number }) { ...
  }
}
```

- `group` est l'identifiant unique du contrôleur.
- `bridge` identifie le type de chaque endpoint. Malgré le fait que c'est redondant avec la définition du bridge, cette
  étape n'est pas automatisée à cause des limitations du langage.
- `handlers` définit les méthodes à exécuter pour chaque endpoint de type `SEND`, `INVOKE` ou `CALLBACK`.
- `triggers` définit les observables RxJS qui déclencheront les envois sur les endpoints de type `ON`.

`handlers` et `triggers` sont des fonctions qui ont pour paramètre l'instance du contrôleur.
De plus, on peut noter que même les membres privés de la classe sont accessibles dans le décorateur.

Une classe de contrôleur peut définir un constructeur, mais ses arguments doivent correspondre à d'autres contrôleurs.
Leurs instances seront automatiquement injectées.

## Enregistrement

Dans le script de lancement d'Electron, il faut appeler la méthode `Controllers.register` avec tous les contrôleurs en
paramètre :

```typescript
Controllers.register(..., ExampleController, ...);
```

Cette méthode instancie les contrôleurs.
L'ordre des contrôleurs importe peu, car la méthode prend en compte les injections de dépendance.
S'il y a des contrôleurs qui implémentent l'interface `OnInit`, la méthode appelle aussi leur méthode `onCovalentInit`.

```mermaid
classDiagram
  class OnInit {
    <<interface>>
    + onCovalentInit() void | PromiseLike~void~
  }
```

L'interface `OnInit` permet aux contrôleurs d'avoir une partie d'initialisation asynchrone (car un constructeur est
forcément synchrone).
Attention aux dépendances avec les autres contrôleurs dans la méthode `onCovalentInit` : les méthodes `onCovalentInit`
sont appelées en parallèle, il se peut donc qu'un contrôleur utilisé dans une de ces méthodes ne soit pas encore
totalement initialisé.
Pour cela, il faut utiliser la méthode `Controllers.waitInit` pour l'ordonnancement.

## Exposition

Dans le script de preload des processus de rendu, il faut appeler la méthode `Controllers.exposeBridge` avec tous les
contrôleurs en paramètre :

```typescript
Controllers.exposeBridge(..., ExampleController, ...);
```

# Utilisation côté rendu

## Installation

Pour installer Covalent dans votre projet frontend, entrez la commande suivante :

```shell
npm i @covalent/render
```

## Définition

Pour définir un proxy, il suffit d'ajouter le décorateur `Proxy` à un service Angular (ou une simple classe s'il ne
s'agit pas d'un projet Angular).

```typescript
import { EMPTY, interval, map } from "rxjs";
import { BridgeOf, BridgeOpen, Bridges, Proxy } from "@covalent/render";

@Injectable() // Décorateur des services Angular.
@Proxy<ExampleProxy, ExampleBridge>({
  group: "example",
  mirror: ["doAction", "calculate"],
  map: (bridge) => ({
    getConfiguration: bridge.getConfig, // ou Bridges.cache(bridge.getConfig) pour optimiser
    date$: Bridges.of(bridge.onDate),
    click$: Bridges.of(bridge.onClick),
    watch: Bridges.open(bridge, "watchMetrics"),
  }),
})
export class ExampleProxy {
  public readonly doAction: ExampleBridge["doAction"]
    = Bridges.Default.Send();
  public readonly getConfiguration: ExampleBridge["getConfig"]
    = Bridges.Default.Invoke({ url: "/" });
  public readonly calculate: ExampleBridge["calculate"]
    = Bridges.Default.Invoke(NaN);
  public readonly date$: BridgeOf<ExampleBridge["onDate"]>
    = interval(250).pipe(map(() => new Date()));
  public readonly click$: BridgeOf<ExampleBridge["onClick"]>
    = EMPTY;
  public readonly watch: BridgeOpen<ExampleBridge["watchMetrics"]>
    = Bridges.Default.Callback({ percentCpuUsage: NaN });

  // Si Bridges.cache est utilisé pour getConfiguration.
  public resetConfig(): void {
    Bridges.invalidateCache(this.getConfiguration);
  }
}
```

- `group` est l'identifiant unique du contrôleur auquel le proxy se rattache.
- `mirror` définit le mappage de l'instance du bridge sur l'instance du proxy pour les membres qui partagent un même
  nom.
  **Attention** : seuls les endpoints de type `SEND` et `INVOKE` peuvent être définis par `mirror`.
- `map` définit le mappage de l'instance du bridge sur l'instance du proxy. Les clés correspondent aux membres du proxy,
  tandis que les valeurs décrivent comment le bridge doit être mappé.
  La classe utilitaire `Bridges` est à utiliser :
  - `cache` peut être utilisé pour les endpoints de type `INVOKE` pour optimiser les appels qui retourneront la même
    valeur à chaque fois pour le paramètre donné.
    `cache` accepte un second argument optionnel pour définir un comportement de réinitialisation, sinon il est
    possible d'utiliser `Bridges.invalidateCache` (cf. `resetConfig`dans l'exemple) ou `Bridges.invalidateCaches` pour
    réinitialiser le cache manuellement.
    _Note_ : les valeurs mises en cache ne sont pas partagées entre plusieurs instances de l'application, et elles
    sont effacées à la fin du programme.
  - `of` doit être utilisé pour gérer les endpoints de type `ON`.
  - `open` doit être utilisé pour gérer les endpoints de type `CALLBACK`.

`mirror` et `map` sont des paramètres optionnels, car un proxy n'est pas obligé d'exposer tous les endpoints de son
contrôleur.

Parce que les rendus Angular pourraient être exécutés dans un contexte hors Electron, il faut définir une valeur par
défaut aux membres qui accueilleront les valeurs fournies par le décorateur `Proxy`.
Pour cela, il faut utiliser les méthodes fournies par la classe utilitaire `Bridges.Default` (pour les endpoints de type
`ON`, la définition d'un observable suffit).
`Bridges.Default.Invoke` et `Bridges.Default.Callback` prennent un paramètre optionnel en argument.
Il définit la valeur par défaut qui sera renvoyée par la fonction.

Le cycle de vie des `CALLBACK` est géré par Covalent.
En reprenant l'exemple, quand on fera un appel à la méthode `watch`, on recevra en retour un `CallbackObservable`.
Cette interface se comporte comme un observable RxJS classique, elle expose juste une méthode supplémentaire :
`complete`.
C'est cette méthode qui fera en coulisse la demande de fermeture du `CALLBACK` au processus principal (cf. diagramme de
séquence du type `CALLBACK`).

_Note_ : il reste possible d'utiliser le bridge sans passer par le décorateur `Proxy` grâce à la méthode`Bridges.bind`,
le décorateur n'étant qu'un moyen facile, sûr et automatisé d'exploiter le bridge.
Il est donc recommandé d'utiliser cette fonction que pour des cas bien particuliers (exemple : proxy générique).
