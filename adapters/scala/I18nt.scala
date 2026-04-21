package i18n

import scala.language.dynamics

/**
 * i18nt Scala Helper Class using Dynamics
 */
class I18nt(val data: Any) extends Dynamic {

  def selectDynamic(name: String): I18nt = {
    data match {
      case m: Map[String, _] @unchecked => 
        new I18nt(m.getOrElse(name, s"[$name]"))
      case _ => 
        new I18nt(s"[$name]")
    }
  }

  def apply(params: Map[String, Any] = Map.empty): String = {
    data match {
      case s: String =>
        params.foldLeft(s) { case (acc, (k, v)) =>
          acc.replace(s"{$k}", v.toString)
        }
      case _ => data.toString
    }
  }

  override def toString: String = data.toString
}
