import Morph from 'src/components/widgets/lively-morph.js';
import ContextMenu from 'src/client/contextmenu.js';
import DragBehavior from "src/client/morphic/dragbehavior.js"

export default class LivelyTable extends Morph {

  static create() {
    // return Object.create(LivelyTable.prototype, {})
    return document.createElement("lively-table")
  }
      
  initialize() {
    this.addEventListener("click", evt => this.onClick(evt))
    lively.html.registerKeys(this, "Table")
    //  this.setAttribute("tabindex", 0)

    this.addEventListener("mousedown", (evt) => this.onMouseDown(evt))
    this.addEventListener("copy", (evt) => this.onCopy(evt))
    this.addEventListener("cut", (evt) => this.onCut(evt))
    this.addEventListener("paste", (evt) => this.onPaste(evt))

    this.addEventListener("focus", (evt) => this.onFocus(evt))
    this.addEventListener("focusout", (evt) => this.onFocusout(evt))

    this.addEventListener("extent-changed", (evt) => this.onExtentChanged(evt));
    this.addEventListener('contextmenu',  evt => this.onContextMenu(evt), false);
  }
  
  isCell(cell) {
    return cell.tagName == "TD" || cell.tagName == "TH"
  }
  
    
  onContextMenu(evt) {
    if (!evt.shiftKey) {
      evt.stopPropagation();
      evt.preventDefault();
      var menu = new ContextMenu(this, [
            ["add column", () => this.insertColumnAt(this.currentColumnIndex)],
            ["remove column", () => this.removeColumnAt(this.currentColumnIndex)],
            ["add row", () => this.insertRowAt(this.currentRowIndex)],
            ["remove row", () => this.removeRowAt(this.currentRowIndex)]
          ]);
      menu.openIn(document.body, evt, this);
      return true;
    }
  }
  
  onExtentChanged() {
    var table = this.get("table")
    lively.setWidth(table, lively.getExtent(this).x)
    lively.setHeight(this, lively.getExtent(table).y, true)
    
  }
  
  async onFocusout() {
     // we are about to lose our focus lets wait a bit
    await lively.sleep(0)
    // if we really lost our focus... 
    if (!this.isInFocus()) {
      this.classList.remove("active")      
    }
  }
    
  onFocus() {
    if (this.isInFocus()) {
      this.classList.add("active")
    }
  }

  clearAllSelection() {
    this.querySelectorAll("td").forEach(ea => {
      ea.classList.remove("editing")
      ea.removeAttribute("contentEditable")
      // ea.contentEditable = false
 
    })
  }
  
  setFocusAndTextSelection(element) {
    if (!element) return;
    this.clearAllSelection()
    element.contentEditable = true
    element.focus()
    var sel = window.getSelection()
    // sel.selectAllChildren(element)
  }

  livelyExample() {
    this.setFromArray([
      ['A','B','C','D','E'],
      ['First', 'Second', 'Third', 'Fourth',''],
      ['Hello', 'World','','',''],
      ['Foo', 'Bar','','','']])
  }

  rows() {
    return Array.from(this.querySelectorAll("tr"))
  }
  
  column(indexOrLabel) {
    var index
    if (Number.isInteger(indexOrLabel)) {
      index = indexOrLabel
    } else {
      index = this.header().indexOf(indexOrLabel)
      if (index == -1) return undefined;
    }
    return this.cells().map( row => row[index])
  }

  cells() {
    return this.rows().map(ea => this.cellsIn(ea))
  }

  cellsIn(row) {
    return Array.from(row.querySelectorAll("td,th"))
  }

  cellAt(columnIndex,rowIndex) {
    var row = this.rows()[rowIndex]
    if (!row) return undefined;
    return row.querySelectorAll("td,th")[columnIndex]
  }
  
  columnOfCell(cell) {
    return this.cellsIn(cell.parentElement).indexOf(cell)
  }
  
  rowOfCell(cell) {
    var row = cell.parentElement
    return this.rows().indexOf(row)
  }

  clearSelection(doNotClearStart) {
    if (this.currentCell) {
      this.currentCell.removeAttribute("contentEditable")
      this.currentCell.classList.remove("table-selected")
    }
    if (!doNotClearStart) {
      this.currentCell = undefined
      this.currentRow = undefined
      this.currentRowIndex = undefined
      this.currentColumnIndex = undefined
      this.currentColumn = undefined
      this.startCell = undefined
      this.startRowIndex = undefined
      this.startColumnIndex = undefined
    }
    
    this.querySelectorAll("td,th").forEach(ea => {
      ea.classList.remove("table-selected")
      ea.classList.remove("start-selection")
    })
    
    this.selectedCells = []
  }

  addSelectedCell(element) {
    if (!this.selectedCells) this.selectedCells = []
      if (this.selectedCells.indexOf(element) < 0) {
        this.selectedCells.push(element)
      }
      element.classList.add("table-selected")
  }

  removeSelectedCell(element) {
    if (!this.selectedCells) this.selectedCells = []
      this.selectedCells.push(element)
    this.selectedCells = this.selectedCells.filter( ea => ea !== element)
    element.classList.remove("table-selected")
  }

  selectCell(element, multipleSelection) {
    if (!this.isCell(element)) return
    if (this.currentCell  && this.currentCell != element) {
      this.currentCell.contentEditable = false
      if (!multipleSelection)
        this.currentCell.classList.remove("table-selected")
    }
    if (!element.parentElement) return; // cell must be one of mine

    this.currentCell = element
    let rows = this.rows(),
      row = element.parentElement,
      rowCells = this.cellsIn(row)
    this.currentRow = element.parentElement
    this.currentRowIndex = rows.indexOf(row)
    this.currentColumnIndex = rowCells.indexOf(element)
    this.currentColumn = rows.map(ea => ea[this.currentColumnIndex])

    if (multipleSelection) {
      this.addSelectedCell( this.currentCell)
    } else {
      if (this.selectedCells) 
        this.selectedCells.forEach(ea => {
          ea.classList.remove("start-selection")
          ea.classList.remove("table-selected")
        });
      this.selectedCells = [this.currentCell]
      this.currentCell.classList.add("table-selected")
      this.startCell = this.currentCell
      this.startRowIndex = rows.indexOf(row)
      this.startColumnIndex = rowCells.indexOf(element)
      this.startCell.classList.add("start-selection")
    }
  }
  
  selectRow(rowIndex, multiselection) {
    if (!multiselection) {
      this.clearSelection()
    }
    this.cells()[rowIndex].forEach(cell => {
      this.selectCell(cell, true)
    })
  }
  
  selectColumn(columnIndex, multiselection) {
    if (!multiselection) {
      this.clearSelection()
    }
    this.cells().forEach(row => {
      this.selectCell(row[columnIndex], true)
    })
  }



  changeSelection(columnDelta, rowDelta, removeSelection) {
    var cells = this.cells()
    let columnA = this.startColumnIndex,
      columnB = this.currentColumnIndex + columnDelta,
      rowA = this.startRowIndex,
      rowB = this.currentRowIndex + rowDelta
    this.changeSelectionBetween(columnA, columnB, rowA, rowB, removeSelection)
  }

  changeSelectionBetween(columnA, columnB, rowA, rowB, removeSelection) {
    var cells = this.cells(),
      columnMin = Math.min(columnA, columnB),
      columnMax = Math.max(columnA, columnB),
      rowMin = Math.min(rowA, rowB),
      rowMax = Math.max(rowA, rowB)
    
    for(var rowIndex = rowMin; rowIndex <= rowMax; rowIndex++) {
      var row = cells[rowIndex]
    
      if (row) {
        // lively.notify("change selection " + columnMin + " " + columnMax)

        for(var columnIndex = columnMin; columnIndex <= columnMax; columnIndex++) {
          var cell = row[columnIndex]
          // lively.showElement(cell)
          if (cell) {
            if (removeSelection) {
              this.removeSelectedCell(cell)
            } else {
              this.addSelectedCell(cell)
            }
          }
        }
      }
    }
    
    this.dispatchEvent(new CustomEvent("selection-changed", {detail: {table: this}}));
  }


  navigateRelative(columnDelta, rowDelta, multipleSelection) {
    if (this.currentColumnIndex === undefined) return
    var cells = this.cells()
    if (multipleSelection) {
      this.changeSelection(-columnDelta, -rowDelta, true)

      this.changeSelection(columnDelta, rowDelta)
    } 
    var row = cells[this.currentRowIndex + rowDelta]
    if (!row) return
    var newCell = row[this.currentColumnIndex + columnDelta]
  
    if (newCell) {
        this.selectCell(newCell, multipleSelection)
    }
  }
  
  
  setTextSelectionOfCellContents(cell) {
    var range = document.createRange();
    var sel = window.getSelection();
    try {
      // #TODO find a more correct way to set selection.... 
      range.setStart(cell, 0);
      // I have problems setting this to the end... so lets go as far as we can in small steps
      for(var i=0; i <= cell.textContent.length; i++) {
        range.setStart(cell, i);
      }
    } catch(e) {
      // do nothing..
    }
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    
  }
  
  //
  // Keyboard Events
  //
  
  onEnterDown(evt) {

    if (!this.currentCell) return
    var cell = evt.srcElement
    if (this.currentCell != cell) return
    var wasEditing = this.isInEditing(cell)

    this.clearSelection(true)
    this.setFocusAndTextSelection(cell)
    this.setTextSelectionOfCellContents(cell)

    if (wasEditing) {
      cell.classList.remove("editing")
    } else {
      cell.classList.add("editing")
    }
    evt.stopPropagation()
    evt.preventDefault()
  }

  onEscDown(evt) {
    if (!this.currentCell) return
    this.setFocusAndTextSelection(this.currentCell)
    evt.stopPropagation()
    evt.preventDefault()
  }

  isInEditing(cell) {
    return cell.classList.contains("editing")
  }

  handleArrowKey(evt, deltaColumn, deltaRow) {
    if (this.isInEditing(this.currentCell)) return
    this.navigateRelative(deltaColumn, deltaRow, evt.shiftKey == true)
    this.setFocusAndTextSelection(this.currentCell)
    evt.stopPropagation()
    evt.preventDefault()
  }

  onLeftDown(evt) {
    this.handleArrowKey(evt, -1, 0)
  }

  onRightDown(evt) {
    this.handleArrowKey(evt, 1, 0)
  }

  onUpDown(evt) {
    this.handleArrowKey(evt, 0, -1)
  }

  onDownDown(evt) {
    this.handleArrowKey(evt, 0, 1)
  }
  
  onMouseDown(evt) {
    
    var cell = evt.composedPath()[0]
    if(cell === this.currentCell) return;
    
    if (cell !== this.currentCell) {
      this.clearSelection(true)
      this.selectCell(cell)
    }
      
    lively.addEventListener("LivelyTable", document.body, "mousemove", 
      evt => this.onMouseMoveSelection(evt))
    lively.addEventListener("LivelyTable", document.body, "mouseup", 
      evt => this.onMouseUpSelection(evt))
    
    // evt.stopPropagation()
    evt.preventDefault()
    
    // lively.notify("mouse down")

  }
  
  onMouseMoveSelection(evt) {
    var cell = evt.composedPath()[0];
    if (this.isCell(cell)) {
      if (cell === this.currentCell) return;
    
      this.clearSelection(true)

      var column = this.columnOfCell(cell)
      var row = this.rowOfCell(cell)

      
      this.changeSelectionBetween(
          this.startColumnIndex, column,
          this.startRowIndex, row)
      
      // lively.notify("mouse move")
    }

  }
  
  //
  // Mouse Events
  //
  
  onMouseUpSelection(evt) {
    lively.removeEventListener("LivelyTable", document.body, "mousemove")
    lively.removeEventListener("LivelyTable", document.body, "mouseup")
     
    var cell = evt.composedPath()[0];
    if (cell === this.currentCell) return; 
    
    this.setFocusAndTextSelection(this.currentCell)    
    // var sel = window.getSelection();
    // sel.removeAllRanges();
    // var range = document.createRange();
    // this.currentCell.focus()
    // range.selectNodeContents(this.currentCell);  
    // sel.addRange(range);
  }

  onClick(evt) {
    if (this.currentCell === evt.srcElement) {
      this.currentCell.contentEditable = true; // edit only on second click into selection
    } else {
      this.selectCell(evt.srcElement)
    } 
    
    this.setFocusAndTextSelection(this.currentCell)

    evt.stopPropagation()
    evt.preventDefault()
  } 

  insertColumnAt(index) {
    this.cells().forEach(cellArray => {
        var oldCell = cellArray[index]
        var newCell = document.createElement(oldCell.tagName)
        oldCell.parentElement.insertBefore(newCell, oldCell)
        newCell.style.width = oldCell.style.width
        
    })
  }

  removeColumnAt(index) {
    this.cells().forEach(cellArray => {
        var oldCell = cellArray[index]
        oldCell.remove()
    })
  }

  isInFocus(focusedElement=document.activeElement) {
    if (focusedElement === this) return true
    if (!focusedElement) return false
    return this.isInFocus(focusedElement.parentElement)
  }
  
  insertRowAt(index) {
    var oldRow = this.rows()[index]
    var newRow = document.createElement("tr")
    newRow.innerHTML = oldRow.innerHTML
    newRow.querySelectorAll("th,td").forEach( ea => ea.textContent = "")
    oldRow.parentElement.insertBefore(newRow, oldRow)
    return newRow
  }


  removeRowAt(index) {
    var oldRow = this.rows()[index]
    oldRow.remove()
  }



  asArray() {
    return Array.from(this.querySelectorAll("tr")).map(eaRow => {
      return Array.from(eaRow.querySelectorAll("td,th")).map(eaCell => eaCell.textContent)
    })
  }

  maxColumnsIn(array) {
    return array.reduce((sum, ea) => Math.max(sum, ea.length), 0)
  }
  
  setFromArrayClean(array) {
    var maxColumns = this.maxColumnsIn(array)
    this.innerHTML = "<table>" +
      array.map((row,rowIndex) => {
        var html = ""
        for(var i=0; i < maxColumns; i++) {
        var ea = row[i] !== undefined ? row[i] : "";
         html += rowIndex == 0 ? // header 
            `<th style="width: 40px">${ea}</th>` : 
            `<td>${ea}</th>`
        }
        return "<tr>" + html+"</tr>"
      }).join("\n")
    + "</table>"
  }
  
  setFromArray(array, force) {
    if (!this.querySelector("tbody") || force) {
      this.setFromArrayClean(array)
    } else {
      var maxColumns  = this.maxColumnsIn(array)
      this.rows().filter((ea,index) => index >= array.length).forEach( ea => ea.remove())
      this.cells().forEach( row => {
        row.filter((cell, index) => {
          return index >= maxColumns
        }).forEach( ea => ea.remove())
      })
      this.querySelectorAll("td,th").forEach(ea => ea.textContent = "")
      this.setFromArrayAt(array, 0, 0) 
    }
  }
  
  
  
  setFromArrayAt(array, columnOffset, rowOffset) {
    var cells = this.cells()
    var header = cells[0]
    var tableLength = columnOffset + array[0].length
    // lively.notify("grow table? " + tableLength  + " " + header.length + " | " + columnOffset + " " + array.length )
    if (tableLength > header.length) {
      var rows = this.rows()
      // we have to grow wider
      rows.forEach((row, index) => {
        for(var i=0; i < (tableLength - header.length); i++) {
          var cell = document.createElement("td")
          row.appendChild(cell)          
        }
      })
      // we changed this contents and have to update
      cells = this.cells()
      header = cells[0]
    }
    for (var i=0; i < array.length; i++) {
      var row = cells[rowOffset + i]
      if (!row) {
        var rowElement = document.createElement("tr")
        rowElement.innerHTML = header.map( ea => "<td></td>").join("")
        this.querySelector("tbody").appendChild(rowElement)
        var row = rowElement.querySelectorAll("td")
        cells.push(row)
      }
      var fromRow = array[i]
      for (var j=0; j < fromRow.length; j++) {
        var index = columnOffset + j
        var cell = row[index];
        if (!cell) throw new Error("No cell at " + index + ", in " + row)
        cell.textContent = fromRow[j]     
      }
    }
  }


  asCSV() {
    return this.asArray().map(eaRow => eaRow.join("\t")).join("\n")
  }
  
  splitIntoRows(csv, separator= /[;\t,]/) {
    return csv.split("\n").map(line => {
      return line.split(separator).map(ea => {
        var m = ea.match(/^"(.*)"$/)
        if (m) {
          return m[1]
        } else {
          return ea
        }
      })
    })
  }
  
  setFromCSV(csv, separator ) {
    this.setFromArray(this.splitIntoRows(csv, separator))
  }
  setFromCSVat(csv, column, row, separator) {
    this.setFromArrayAt(this.splitIntoRows(csv, separator), column, row)
  }
  
  asJSO() {
    var all = this.asArray()
    var header = all[0]
    return all.slice(1).map(row => {
      var obj = {}
      row.forEach((ea,index) => {
        var name= header[index]
        obj[name] = ea
      })
      return obj
    })
  }
  
  
  copySelectionAsTable() {
    var tmp = LivelyTable.create()
    tmp.setFromArray(
      _.values(_.groupBy(this.selectedCells, ea => this.rowOfCell(ea)))
        .map(row =>
          _.sortBy(row, ea => this.columnOfCell(ea)).map(ea => ea.textContent) ))
    return tmp
  }
  
  getSelectionAsCSV() {
    return this.copySelectionAsTable().asCSV()
  }
  
  getSelectionAsJSO() {
    if(!this.selectedCells) return []
    
    let result = []
    
    this.selectedCells.forEach(each => {
      let row = this.rowOfCell(each)
      let key = this.keyForCell(each)
      if(!result[row]) result[row] = {}
      result[row][key] = each.textContent
    })
    
    return result
  }
  
  keyForCell(cell) {
    return this.cells()[0][this.columnOfCell(cell)].textContent
  }
  
  /*
   * set the contents of the table from a JSO where the keys of each object will become the header
   * example: [{a: 1, b: 2}, {a: 4, b: 5, c: 6}]
   */
  setFromJSO(jso) {
    if (!jso) return
    var headers = []
    var rows = jso.map(obj => {
      obj = obj || {}
      // add headers that are introduced in that row
      Object.keys(obj).forEach(key => {
        if (headers.indexOf(key) < 0) {
          headers.push(key)        
        }
      })
      return headers.map(key => {
        return obj[key]
      })
    })  
    rows.unshift(headers)
    this.setFromArray(rows)
  }
  
  
  onCopy(evt) {
    // lively.notify("on copy")

    if (!this.currentCell) return
    if (this.selectedCells && this.selectedCells.length > 1) {
      var data = this.getSelectionAsCSV()
      // lively.notify("data " + data)
      evt.clipboardData.setData('text/plain', data);
    } else {
      var selString = window.getSelection().toString();
      if (selString.length > 0) {
        evt.clipboardData.setData('text/plain', selString);
      } else {
        evt.clipboardData.setData('text/plain', this.currentCell.textContent);
      }
    }
    evt.stopPropagation()
    evt.preventDefault()
  }
  
  onCut(evt) {
    this.onCopy(evt)
    if (this.selectedCells && this.selectedCells.length > 1) {
      // lively.notify("cut " + this.selectedCells.length)
      this.selectedCells.forEach(ea => {
        ea.textContent = ""
      })
    } else {
      this.currentCell.textContent = ""
    }
    
  }

  onPaste(evt) {
    // lively.notify("on paste")

    if (!this.currentCell) return
    
    
    var cells
    if (this.selectedCells && this.selectedCells.length > 1) {
      // lively.notify("cut " + this.selectedCells.length)
      cells = this.selectedCells
    } else {
      cells = [this.currentCell]
    }

    var data = evt.clipboardData.getData('text/plain')

    this.selectedCells.map(ea => { // cells will change so get them early... 
      return {column: this.columnOfCell(ea), row: this.rowOfCell(ea)}
    }).forEach(ea => {
      this.setFromCSVat(data, ea.column, ea.row)
    })
    evt.stopPropagation()
    evt.preventDefault()
  }


  livelyMigrate(other) {
    this.clearSelection()
    var selection = this.cellAt(other.currenColumnIndex, other.currentRowIndex)
    if (selection) this.selectCell(selection)
  }

  header() {
    return this.asArray()[0]
  }
  

}
      

     
      