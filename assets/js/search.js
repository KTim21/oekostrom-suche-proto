document.addEventListener("DOMContentLoaded", function () {
  if (document.getElementById('app')) {
    const EventBus = new Vue();

    Vue.component('v-search', {
      props: [],
      template: `
<label>Suche deinen Anbieter
  <input type="text"
         placeholder="zB Anbietername, Website oder Stadt"
         @input="$emit('typing', $event.target.value)">
</label>`,
      methods: {},
      computed: {}
    });

    Vue.component('v-item', {
      props: ['item', 'criteria'],
      template: `
<li>
  <a @click="select(item)">
    <h4>{{ item['Firmenname'] }}</h4>
  </a>
</li>`,
      methods: {
        select(item) {
          EventBus.$emit('select-item', this.item);
        }
      }
    });

    Vue.component('v-list', {
      props: ['list', 'criteria'],
      template: `
<ul>
  <v-item v-for="item in list"
          :key="item.index"
          :item="item"
          :criteria="criteria"></v-item>
</ul>`
    });

    Vue.component('v-profile', {
      props: ['item', 'criteria'],
      template: `
<article v-if="item">
  <h1>{{this.item['Firmenname']}}</h1>
  <p>{{ criteria[item['RoWo-Kriterien']]['cat']}}</p>
  <template v-if="criteria[item['RoWo-Kriterien']]">
    <p><strong>{{ criteria[item['RoWo-Kriterien']]['title']}}</strong></h3>
    <p>{{ criteria[item['RoWo-Kriterien']]['text']}}</p>
    <a :href="criteria[item['RoWo-Kriterien']]['link']">{{ criteria[item['RoWo-Kriterien']]['link_label']}}</a>

    <p v-if="item['Begründung']">{{ item['Begründung'] }}</p>

    <p v-if="criteria[item['RoWo-Kriterien']]['show_profile'] == 'True'">
      Zum <a href="#">RoWo-Anbieterprofil</a> von {{this.item['Firmenname']}}
    </p>

    <p v-if="criteria[item['RoWo-Kriterien']]['show_energymix'] == 'True'">
      Siehe <a :href="item['Kennzeichnung Link']">Strommix</a> von {{this.item['Firmenname']}}
    </p>

    <p v-if="criteria[item['RoWo-Kriterien']]['method_label']">
      <small>{{ criteria[item['RoWo-Kriterien']]['method_label'] }}<br>
      <a href="{{ criteria[item['RoWo-Kriterien']]['method_link'] }}">Über die Methoden</a></small>
    </p>
  </template>
  <hr>
  <h2>Allgemeine Infos zum Anbieter</h2>
  <p>{{ item['Firmenname']}}</p>
  <p v-if="item['Stadt']">{{ item['Adresse']}}, {{ item['PLZ']}} {{ item['Stadt']}}</p>
  <p v-if="item['URL']"><a :href="item['URL']">{{ item['URL']}}</a></p>
  <p v-if="item['Zertifizierung']">Ein oder mehrere Stromprodukte dieses Anbietern wurden mit diesen Sigeln/Labeln zertifiziert:<br>
    {{ item['Zertifizierung'] }}</p>
  <hr>
  <p>Permalink für diesen Abieter im Ökostrombericht <input readonly type="text" :value="makeHref"></p>
</article>`,
      computed: {
        makeHref() {
          return `${window.location}?anbieter=${encodeURI(this.item['Firmenname'])}`;
        }
      }
    });

    var app = new Vue({
      el: '#app',
      data: {
        original: [],
        providers: [],
        search: '',
        results: [],
        searchIndex: null,
        criteria: {},
        selectedProvider: {},
        state: 'search' // or profile
      },
      template: `
<div class="v-search">
  <template v-if="state == 'search'">
    <template v-if="searchIndex">
      <v-search v-on:typing="this.searching"></v-search>
      <p v-if="this.results != 0">Anzahl Ergebnisse für "{{this.search}}":  {{this.results.length}}</p>
    </template>
    <p v-else>Anbieterdaten werden geladen</p>
    <v-list :list="this.results" :criteria="this.criteria"></v-list>
  </template>
  <template v-else>
    <button type="button" @click="toSearch">◂ Zu den Suchergebnissen</button>
    <v-profile v-if=selectedProvider
               :item="selectedProvider"
               :criteria="this.criteria"></v-profile>
    <p v-else>Anbieter nicht gefunden</p>
  </template>
</div>`,
      mounted: function() {
        let baseUrl = window.baseurl || '';
        const url = `${baseUrl}/assets/data/indexanddata.json`;

        EventBus.$on('select-item', item => {
          this.selectedProvider = item;
          this.state = 'profile';
        });

        Promise.all([
          fetch(url).then((response)=>{
            return response.json();
          }).then((data)=>{
            this.original = data;
            this.providers = this.original.store;
            // lunr index is prebuild in scripts/build_index.js
            this.searchIndex = lunr.Index.load(data.idx);
          }),
          fetch(`${baseUrl}/assets/data/criteria.csv`)
            .then(response => {
              return response.text();
            }).then((data) => {
              let criteria = data.split('\n').slice(1).map(x => x.split(';'));
              criteria.forEach((v, i) => {
                let idx = v[0];
                this.criteria[idx] = {};
                this.criteria[idx]['cat'] = v[1];
                this.criteria[idx]['title'] = v[2];
                this.criteria[idx]['text'] = v[3];
                this.criteria[idx]['link'] = v[4];
                this.criteria[idx]['link_label'] = v[5];
                this.criteria[idx]['method_label'] = v[6];
                this.criteria[idx]['method_link'] = v[7];
                this.criteria[idx]['show_profile'] = v[8];
                this.criteria[idx]['show_energymix'] = v[9];
              });
            })]).then(() => {
              let params = window.location.search.split("?anbieter=");
              if (params.length != -1 && params.length > 1) {

                let results = Object.values(this.providers)
                    .filter((x, i) => encodeURI(x['Firmenname']) === params[1]);
                if (results.length < 0) {
                  console.log('Nothing found, try search');
                  this.state = 'search';
                } else {
                  this.selectedProvider = results[0];
                  this.state = 'profile';
                }
              } else {
                this.state = 'search';
              }
            });
      },
      methods: {
        searching(term) {
          this.search = term;
          if (term.length > 2) {
            let results = this.searchIndex.search(term + '~1');
            this.results = results.map(v => {
              let indexAsInt = parseInt(v.ref, 10);
              return this.providers[indexAsInt];
            });
          } else {
            this.results = [];
          }
        },
        toSearch() {
          this.state = 'search';
        }
      }
    });
  }
});
