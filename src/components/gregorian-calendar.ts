import { html, customElement, TemplateResult, property, query, css, queryAll } from 'lit-element';

import CalendarBaseElement from './calendar-base';
import { calendarBaseStyle } from '../base-style';
import './month-list';
import { YearList } from './year-list';
import './year-list';
import { DecadeList } from './decade-list';
import './decade-list';
import { HeaderElement } from './header';
import './header';

import { convertStringToNumberArray } from '../utils/convert-string-to-number-array';
import './week-labels';

// This class is based on gregorian, then we can use the following:
import { weekDayList, monthsDaysCount, monthList } from '../data/gregorian';

interface MonthInterface {
  name: string;
  shortName: string;
  code: number;
}

@customElement('gregorian-calendar-element')
export class GregorianCalendarElement extends CalendarBaseElement {
  @property({ type: Array })
  monthList: MonthInterface[] = monthList;

  @query('week-labels')
  weekLabelsElement!: HTMLElement;

  @query('header-element')
  headerElement: HeaderElement | undefined;

  @query('year-list')
  yearListElement: YearList | undefined;

  @query('decade-list')
  decadeListElement: DecadeList | undefined;

  @queryAll('.calendar-day')
  calendarDayElementList: HTMLDivElement[] | undefined;

  protected calendarInitDate: number[] = [];
  protected calendarActiveDate: number[] = [];
  protected calendarOnScreenDate: number[] = [];
  protected selectedDayList: number[] = [];
  protected calendarWeekList: number[][] = [];
  protected leapMonthIndex: number = 1;
  protected weekDayList = weekDayList;

  static styles = [calendarBaseStyle, css``];

  constructor() {
    super();

    this.minDate = '1900-1-1';
    this.maxDate = '2200-1-1';

    this.minDateArray = convertStringToNumberArray(this.minDate, '-');
    this.maxDateArray = convertStringToNumberArray(this.maxDate, '-');

    this.monthList = monthList;
    this.monthsDaysCount = monthsDaysCount;
    this.weekDayList = weekDayList;
  }

  protected update(changedProperties: Map<string | number | symbol, unknown>) {
    this._log('update');

    // Prevent re-rendering when shortWeekLabel is changed
    if (changedProperties.has('shortWeekLabel') && !this.shortWeekLabel) {
      if (this.weekLabelsElement) {
        this.weekLabelsElement.removeAttribute('short-name');
        return;
      }
    }

    // Create array of initDate when it's changed
    if (changedProperties.has('initDate')) {
      if (new Date(this.initDate as string).getTime() > new Date(`${this.maxDateArray[0]}-${this.maxDateArray[1]}-${this.maxDateArray[2]}`).getTime()) {
        this.initDate = this.maxDate as string;
      }

      if (new Date(this.initDate as string).getTime() < new Date(`${this.minDateArray[0]}-${this.minDateArray[1]}-${this.minDateArray[2]}`).getTime()) {
        this.initDate = this.minDate as string;
      }

      this._log('update: %o', this.initDate);
      this.onScreenDate = this.initDate;

      const initDateArray = convertStringToNumberArray(this.initDate as string, '-');
      this.calendarInitDate = initDateArray;
      // We need a cloned array here
      this.calendarOnScreenDate = initDateArray.slice(0);
      this.calendarActiveDate = initDateArray.slice(0);
      this.calendarWeekList = this.calculateCalendar();
    }

    if (changedProperties.has('activeDate')) {
      this.calendarActiveDate = convertStringToNumberArray(this.activeDate as string, '/');
    }

    super.update(changedProperties);
  }

  protected render(): TemplateResult {
    this._log('render');

    const today = this.ifActiveDateExist() ? this.calendarInitDate[2] : -1;

    return html`
      <header-element
        ?hidden="${this.activeView === 'clock'}"
        @prev-month="${this.renderPrevMonth}"
        @next-month="${this.renderNextMonth}"
        @prev-year="${this.prevYear}"
        @next-year="${this.nextYear}"
        @prev-decade="${this.prevDecade}"
        @next-decade="${this.nextDecade}"
        @show-month-list="${() => { this.activeView = 'monthList' }}"
        @show-year-list="${() => { this.activeView = 'yearList' }}"
        @show-decade-list="${() => { this.activeView = 'decadeList' }}"
        debug
      >
      </header-element>
      <div class="views-container">
        <div class="view" ?hidden="${this.activeView !== 'calendar'}">
          <week-labels .weekLabelList="${this.weekDayList}"></week-labels>
          ${this.calendarWeekList.map((week: number[], index: number) => {
            return html`
              <div class="calendar-row">
                ${week.map((day: number) => {
                  return this.getWeekDaysTemplate(day, index, today);
                })}
              </div>
              `
            })
          }
        </div>
        <month-list
          class="view"
          ?hidden="${this.activeView !== 'monthList'}"
          .monthList="${this.monthList}"
          @month-changed-to="${this.onMonthChangedTo}"
          debug
        >
        </month-list>
        <year-list
          class="view"
          ?hidden="${this.activeView !== 'yearList'}"
          .currentYear="${this.calendarOnScreenDate[0]}"
          .minYear="${this.minDateArray[0]}"
          .maxYear="${this.maxDateArray[0]}"
          @year-changed-to="${this.onYearChangedTo}"
          debug
        >
        </year-list>
        <decade-list
          class="view"
          ?hidden="${this.activeView !== 'decadeList'}"
          .currentYear="${this.calendarOnScreenDate[0]}"
          .minYear="${this.minDateArray[0]}"
          .maxYear="${this.maxDateArray[0]}"
          @decade-changed-to="${this.onDedcadeChangedTo}"
          @decade-changed="${this.decadeChanged}"
          debug
        >
        </year-list>
      </div>
    `;
  }

  protected firstUpdated(changedProperties: Map<string | number | symbol, unknown>) {
    super.firstUpdated(changedProperties);
    this._log('firstUpdated');

    this._fire('current-month-changed', this.calendarOnScreenDate[1], true);
  }

  protected updated(changedProperties: Map<string | number | symbol, unknown>) {
    this._log('updated');

    if (changedProperties.has('activeView')) {
      this.handleHeaderTitle();
    }

    if (this.weekLabelsElement && this.shortWeekLabel) {
      this.weekLabelsElement.setAttribute('short-name', '');
    }

    if (this.rangePicker) {

      if (this.selectedDateList.length === 2) {
        this.highlightInRangeDayList();
      }
      else {
        Array.from(this.calendarDayElementList as HTMLDivElement[]).map(dayElement => { dayElement.removeAttribute('style'); });
      }
    }
  }

  protected getWeekDaysTemplate(day: number, index: number, today: number): TemplateResult {
    // this._log('getCalendarWeekTemplate');

    const notForThisMonth = ((index === 0 && day > 7) || (index > 2 && day < 15));
    // const selected = this.selectedDayList.includes(day) && (this.calendarOnScreenDate[1] === this.selectedDateList[0][1] || this.calendarOnScreenDate[1] === this.selectedDateList[1][1]);
    // const edge = selected && props.selectedDate.length > 1;
    return html`
      <div
        class="calendar-day${(notForThisMonth ? ' fade' : (this.highlightToday && today === day) ? ' current-date-highlight' : '')}"
        .date="${!notForThisMonth ? [this.calendarOnScreenDate[0], this.calendarOnScreenDate[1], day] : undefined}"
        @click="${this.onDayClick}"
      >
      <div class="calendar-day-data">
        ${this.onlyShowCurrentMonthDays && notForThisMonth ? '' : day}
      </div>
    </div>
    `;
  }

  // TODO: Complete this method
  protected onDayClick(event: MouseEvent) {
    this._log('onDayClick');

    const currentDate = event.currentTarget?.['date'];
    if (!currentDate) return;

    if (!this.rangePicker) {
      Array.from(this.calendarDayElementList as HTMLDivElement[]).map(dayElement => { dayElement.removeAttribute('style'); });
      (event.currentTarget as HTMLDivElement).setAttribute('style', 'background: #A0144F; color: rgba(255, 255, 255, 0.87);');
    }
    else {
      this.selectedDateList.push(currentDate);
      (event.currentTarget as HTMLDivElement).setAttribute('style', 'background: #A0144F; color: rgba(255, 255, 255, 0.87);');

      if (this.selectedDateList.length === 2) {
        this.selectedDateList = [...this.selectedDateList];
        this._log('onDayClick: %o', this.selectedDateList);
      }

      if (this.selectedDateList.length > 2) {
        Array.from(this.calendarDayElementList as HTMLDivElement[]).map(dayElement => { dayElement.removeAttribute('style'); });
        this.selectedDateList = [];
      }
    }
  }

  protected highlightInRangeDayList() {
    this._log('highlightInRangeDayList');

    const calendarDayElementListArray = Array.from(this.calendarDayElementList as HTMLDivElement[]);
    calendarDayElementListArray.map(dayElement => { dayElement.removeAttribute('style'); });

    if (this.selectedDateList[0][0] > this.selectedDateList[1][0] ||
        (this.selectedDateList[0][0] === this.selectedDateList[1][0] && this.selectedDateList[0][1] > this.selectedDateList[1][1]) ||
        (this.selectedDateList[0][0] === this.selectedDateList[1][0] && this.selectedDateList[0][1] === this.selectedDateList[1][1] &&  this.selectedDateList[0][2] > this.selectedDateList[1][2])
    ) {
      this.selectedDateList.reverse();
    }

    for (const dayElement of calendarDayElementListArray) {
      if (!dayElement['date']) continue;
      this.checkEdgeSelectedDate(dayElement);
      if (!this.isInRange(dayElement['date'])) continue;
      dayElement.setAttribute('style', 'background: #A0144F23; border-radius: 0;');
    }
  }

  private checkEdgeSelectedDate(dayElement: HTMLDivElement) {
    this._log('checkEdgeSelectedDate');
    if (this.selectedDateList[0][0] === dayElement['date'][0] &&
        this.selectedDateList[0][1] === dayElement['date'][1] &&
        this.selectedDateList[0][2] === dayElement['date'][2]
      ) {
      dayElement.setAttribute('style', 'background: #A0144F; color: rgba(255, 255, 255, 0.87); transition: ease-in 0.15s; border-radius: 50% 0 0 50%;');
    }

    if (this.selectedDateList[1][0] === dayElement['date'][0] &&
        this.selectedDateList[1][1] === dayElement['date'][1] &&
        this.selectedDateList[1][2] === dayElement['date'][2]
    ) {
      dayElement.setAttribute('style', 'background: #A0144F; color: rgba(255, 255, 255, 0.87); transition: ease-in 0.15s;  border-radius: 0 50% 50% 0;');
    }
  }

  private isInRange(dayDate: number[]) {
    // this._log('ifIsInRange');
    return (
        (this.selectedDateList[0][0] <= dayDate[0] && this.selectedDateList[0][1] < dayDate[1]) ||
        (this.selectedDateList[0][1] === dayDate[1] && this.selectedDateList[0][2] < dayDate[2])
      ) &&
      (
        (this.selectedDateList[1][0] >= dayDate[0] && this.selectedDateList[1][1] > dayDate[1]) ||
        (this.selectedDateList[1][1] === dayDate[1] && this.selectedDateList[1][2] > dayDate[2])
      );
  }

  protected ifActiveDateExist(): boolean {
    this._log('ifActiveDateExist');

    return (this.calendarActiveDate[0] === this.calendarOnScreenDate[0] &&
      this.calendarActiveDate[1] === this.calendarOnScreenDate[1]);
  }

  protected leapYearCalculation(year: number): number {
    this._log('leapYearCalculation');

    let isLeap: number = 0;
    if (((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0)) {
      isLeap = 1;
    }
    return isLeap;
  };

  protected calculateCalendar(): number[][] {
    this._log('calculateCalendar');

    let date = new Date(`${this.calendarOnScreenDate[0]}-${this.calendarOnScreenDate[1]}-1`);

    const currentMonthDaysCount = this.monthsDaysCount[this.calendarOnScreenDate[1] - 1] + (
      this.calendarOnScreenDate[1] - 1 === this.leapMonthIndex
        ? this.leapYearCalculation(this.calendarOnScreenDate[0])
        : 0
    );

    let tempYear = this.calendarOnScreenDate[0];
    let previousMonthIndex: number = this.calendarOnScreenDate[1] - 2;
    if (previousMonthIndex <= 0) {
      tempYear--;
      if (tempYear < this.minDateArray[0]) {
        tempYear = this.minDateArray[0];
      }
      previousMonthIndex = 11;
    }
    const previousMonthDaysCount = this.monthsDaysCount[previousMonthIndex] + (previousMonthIndex === this.leapMonthIndex ? this.leapYearCalculation(tempYear) : 0);

    const startWeekAtIndex = date.getDay();
    this._log('startWeekAtIndex: %s', startWeekAtIndex);
    // console.log(startWeekAtIndex);

    let totalCells = currentMonthDaysCount + startWeekAtIndex;
    // this._log('totalCells: %s', totalCells);

    let calendar: Array<number[]> = [];
    let week = Array.from({ length: startWeekAtIndex }, (_v, k) => (previousMonthDaysCount - startWeekAtIndex) + k + 1);

    for (let i = startWeekAtIndex + 1; calendar.length < 6; ++i) {
      const day = i > totalCells ? i - totalCells : i - startWeekAtIndex;
      if (i % 7 === 0) {
        week.push(day);
        calendar.push(week);
        week = [];
        if ((this.onlyShowCurrentMonthDays || this.hideLastFadedRow) && 7 * calendar.length >= totalCells) break;
        continue;
      }
      week.push(day);
    }

    return calendar;
  }

  protected sortRangeSelectedDates(selectedDates: number[][] | undefined): number[][] {
    if (!selectedDates) return [];
    this._log('sortRangeSelectedDates');

    const startDate = Date.parse(selectedDates[0].toString());
    const endDate = Date.parse(selectedDates[1].toString());

    return startDate > endDate ? [selectedDates[1], selectedDates[0]] : selectedDates;
  };

  protected calculateSelectedDayList() {
    this._log('calculateSelectedDayList');
    let days: Array<number> = [];
    let [onScreenYear, onScreenMonth]: Array<number> = this.calendarOnScreenDate;

    this.selectedDateList.forEach(([selectedDateYear, selectedDateMonth, selectedDateDay]: Array<number>) => {
      if (selectedDateYear === onScreenYear &&
        selectedDateMonth === onScreenMonth)
        days.push(selectedDateDay);
    });

    return days;
  };

  renderPrevMonth() {
    this._log('renderPrevMonth');

    if (this.calendarOnScreenDate[1] - 1 === 0) {
      if (this.calendarOnScreenDate[0] - 1 > this.minDateArray[0]) {
        this.calendarOnScreenDate = [this.calendarOnScreenDate[0] - 1, 12, 1];
      }
      else {
        this.calendarOnScreenDate = this.minDateArray;
      }
    }
    else {
      --this.calendarOnScreenDate[1];
    }

    this.calculateCalendarWeekList();
    this.handleHeaderTitle();
  }

  renderNextMonth() {
    this._log('renderNextMonth');

    if (this.calendarOnScreenDate[1] + 1 > 12) {
      if (this.calendarOnScreenDate[0] + 1 < this.maxDateArray[0]) {
        this.calendarOnScreenDate = [this.calendarOnScreenDate[0] + 1, 1, 1];
      }
      else {
        this.calendarOnScreenDate = this.maxDateArray;
      }
    }
    else {
      ++this.calendarOnScreenDate[1];
    }

    this.calculateCalendarWeekList();
    this.handleHeaderTitle();
  }

  prevYear() {
    this._log('prevYear');
    this.calendarOnScreenDate[0] = this.calendarOnScreenDate[0] - 1;
    if (this.calendarOnScreenDate[0] <= this.minDateArray[0]) {
      this.calendarOnScreenDate[0] = this.minDateArray[0];
    }
    this.calculateCalendarWeekList();
  }

  nextYear() {
    this._log('nextYear');

    this.calendarOnScreenDate[0] = this.calendarOnScreenDate[0] + 1;
    if (this.calendarOnScreenDate[0] >= this.maxDateArray[0]) {
      this.calendarOnScreenDate[0] = this.maxDateArray[0];
    }
    this.calculateCalendarWeekList();
  }

  prevDecade() {
    this._log('prevDecade');

    this.calendarOnScreenDate[0] = (this.calendarOnScreenDate[0] - this.calendarOnScreenDate[0] % 10) - 10;
    if (this.calendarOnScreenDate[0] < this.minDateArray[0]) {
      this.calendarOnScreenDate[0] = this.minDateArray[0];
      return;
    }
    this.calculateCalendarWeekList();
  }

  nextDecade() {
    this._log('nextDecade');

    this.calendarOnScreenDate[0] = (this.calendarOnScreenDate[0] - this.calendarOnScreenDate[0] % 10) + 10;
    if (this.calendarOnScreenDate[0] >= this.maxDateArray[0]) {
      this.calendarOnScreenDate[0] = this.maxDateArray[0];
      return;
    }
    this.calculateCalendarWeekList();
  }

  calculateCalendarWeekList() {
    this._log('calculateCalendarWeekList');

    this.calendarWeekList = this.calculateCalendar();
    this._fire('current-month-changed', this.calendarOnScreenDate[1], true);
    this._fire('current-year-changed', this.calendarOnScreenDate[0], true);
    this.requestUpdate();
  }

  private onMonthChangedTo(event: CustomEvent) {
    this._log('onMonthChangedTo');

    this.calendarOnScreenDate[1] = event.detail;
    this.calculateCalendarWeekList();
    this.activeView = 'calendar';
  }

  private onYearChangedTo(event: CustomEvent) {
    this._log('onYearChangedTo');

    this.calendarOnScreenDate[0] = event.detail;
    this.activeView = 'monthList';
    this.calculateCalendarWeekList();
  }

  private decadeChanged(event: CustomEvent) {
    this._log('decadeChanged');

    if ( !(this.headerElement && ['yearList', 'decadeList'].includes(this.activeView)) ) return;

    this.headerElement.title = `${event.detail[0]}-${event.detail[1]}`;
  }

  private onDedcadeChangedTo(event: CustomEvent) {
    this._log('onDedcadeChangedTo');

    this.calendarOnScreenDate[0] = event.detail[0] as number;
    if (this.yearListElement) {
      this.yearListElement.currentYear = event.detail[0] as number;
    }
    requestAnimationFrame(() => {
      this.activeView = 'yearList';
      this.calculateCalendarWeekList();
    });
  }

  private handleHeaderTitle() {
    this._log('handleHeaderTitle');

    if (!this.headerElement) return;

    switch (this.activeView) {
      case 'calendar':
        this.headerElement.calendarActiveView = this.activeView;
        this.headerElement.title = `${this.monthList[this.calendarOnScreenDate[1] - 1]?.name} ${this.calendarOnScreenDate[0]}`;
        break;

      case 'monthList':
        this.headerElement.calendarActiveView = this.activeView;
        this.headerElement.title = this.calendarOnScreenDate[0] + '';
        break;

      case 'yearList':
      case 'decadeList':
        this.headerElement.calendarActiveView = this.activeView;
        if (this.decadeListElement) {
          this.headerElement.title = `${this.decadeListElement.activeDecade[0]}-${this.decadeListElement.activeDecade[1]}`;
        }
        break;

      default:
        this._warn('Invalid view');
        break;
    }
  }
}
